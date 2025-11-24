package com.cbv.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import java.io.FileInputStream
import java.io.FileOutputStream
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory
import kotlin.concurrent.thread
import org.json.JSONObject

class VPNConnectionService : VpnService() {

    private val TAG = "VPNConnectionService"
    private val NOTIFICATION_ID = 1
    private val CHANNEL_ID = "VPN_SERVICE_CHANNEL"

    private var vpnInterface: ParcelFileDescriptor? = null
    private var vpnThread: Thread? = null
    private var isRunning = false

    private var proxyServer: String = ""
    private var proxyServerIP: String = ""
    private var proxyPort: Int = 0
    private var proxyUsername: String = ""
    private var proxyPassword: String = ""
    private var proxyType: String = "socks5"

    private var connectionManager: ConnectionManager? = null
    private var udpHandler: UDPHandler? = null

    private var connectionStartTime: Long = 0L
    private var bytesUp: Long = 0L
    private var bytesDown: Long = 0L
    private var publicIp: String? = null

    // Health check mechanism for always-on VPN
    private var healthCheckThread: Thread? = null
    private var lastPacketTime: Long = 0L
    private val HEALTH_CHECK_INTERVAL_MS = 10000L // Check every 10 seconds
    private val CONNECTION_TIMEOUT_MS = 600000L // Consider dead after 10 minutes (was 30s)

    // Public IP check mechanism
    private var publicIpCheckThread: Thread? = null
    private val PUBLIC_IP_CHECK_INTERVAL_MS = 30000L // Check every 30 seconds

    private val bytesReceivedReceiver =
            object : android.content.BroadcastReceiver() {
                override fun onReceive(
                        context: android.content.Context?,
                        intent: android.content.Intent?
                ) {
                    val bytes = intent?.getLongExtra("bytes", 0L) ?: 0L
                    bytesDown += bytes
                }
            }

    companion object {
        const val ACTION_VPN_STATUS = "com.cbv.vpn.VPN_STATUS"
        const val EXTRA_STATUS = "status"
        const val EXTRA_IS_CONNECTED = "isConnected"
        const val EXTRA_DURATION = "durationMillis"
        const val EXTRA_BYTES_UP = "bytesUp"
        const val EXTRA_BYTES_DOWN = "bytesDown"
        const val EXTRA_ERROR = "error"
        const val STATUS_CONNECTED = "connected"
        const val STATUS_DISCONNECTED = "disconnected"
        const val STATUS_CONNECTING = "connecting"
        const val STATUS_HANDSHAKING = "handshaking"
        const val COMMAND_STOP = "stop"
        const val COMMAND_STATUS = "status"
        const val EXTRA_PUBLIC_IP = "publicIp"
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "VPNConnectionService created")
        createNotificationChannel()
        // Check notification permission on Android 13+
        val notifAllowed =
                try {
                    if (Build.VERSION.SDK_INT >= 33) {
                        val granted =
                                ContextCompat.checkSelfPermission(
                                        this,
                                        android.Manifest.permission.POST_NOTIFICATIONS
                                ) == android.content.pm.PackageManager.PERMISSION_GRANTED
                        if (!granted) {
                            Log.w(TAG, "POST_NOTIFICATIONS not granted on API>=33")
                        }
                        granted
                    } else {
                        NotificationManagerCompat.from(this).areNotificationsEnabled()
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Unable to check notification permission: ${e.message}")
                    true
                }

        if (!notifAllowed) {
            Log.e(TAG, "Cannot start foreground: notification permission missing")
            try {
                broadcastStatus(
                        STATUS_DISCONNECTED,
                        force = true,
                        error = "Notification permission required on Android 13+"
                )
                // Ask RN layer to request permission and bring app to foreground
                val reqIntent = Intent("com.cbv.vpn.REQUEST_NOTIF_PERMISSION")
                androidx.localbroadcastmanager.content.LocalBroadcastManager.getInstance(this)
                        .sendBroadcast(reqIntent)
            } catch (_: Exception) {}
            stopSelf()
            return
        }

        val notification = createNotification("VPN Service")
        val fgsType =
                if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                else 0
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, fgsType)
        } catch (e: Exception) {
            Log.w(TAG, "ServiceCompat.startForeground failed: ${e.message}")
            try {
                startForeground(NOTIFICATION_ID, notification)
            } catch (e2: Exception) {
                Log.e(TAG, "startForeground failed: ${e2.message}")
                broadcastStatus(STATUS_DISCONNECTED, force = true, error = e2.message)
                stopSelf()
                return
            }
        }

        // Register receiver for bytes received from connections via LocalBroadcastManager
        val filter = android.content.IntentFilter("com.cbv.vpn.BYTES_RECEIVED")
        LocalBroadcastManager.getInstance(this).registerReceiver(bytesReceivedReceiver, filter)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent != null) {
            val action = intent.getStringExtra("action")

            if (action == COMMAND_STOP) {
                val force = intent.getBooleanExtra("force", false)
                val prefs = getSharedPreferences("vpn_prefs", MODE_PRIVATE)
                val automationActive = prefs.getBoolean("automation_session_active", false)

                if (automationActive && !force) {
                    Log.w(
                            TAG,
                            "⚠️ Stop request ignored because automation session is active (force=$force)"
                    )
                    return START_NOT_STICKY
                }

                // Clear automation flag when a forced stop is allowed
                prefs.edit().putBoolean("automation_session_active", false).apply()
                stopVPN()
                return START_NOT_STICKY
            }
            if (action == COMMAND_STATUS) {
                val currentStatus = if (isRunning) STATUS_CONNECTED else STATUS_DISCONNECTED
                broadcastStatus(currentStatus, force = true)
                return START_NOT_STICKY
            }

            proxyServer = intent.getStringExtra("server") ?: ""
            proxyServerIP = intent.getStringExtra("serverIP") ?: proxyServer
            proxyPort = intent.getIntExtra("port", 0)
            proxyUsername = intent.getStringExtra("username") ?: ""
            proxyPassword = intent.getStringExtra("password") ?: ""
            proxyType = intent.getStringExtra("type") ?: "socks5"

            Log.d(TAG, "Starting VPN with proxy: $proxyType://$proxyServer:$proxyPort")

            if (proxyServer.isEmpty() || proxyPort <= 0) {
                val err = "Invalid proxy configuration"
                Log.e(TAG, "❌ $err: server='$proxyServer' port=$proxyPort")
                broadcastStatus(STATUS_DISCONNECTED, force = true, error = err)
                stopSelf()
                return START_NOT_STICKY
            }

            startVPN()
        } else {
            // Service restarted by system - check if auto-reconnect is enabled
            Log.d(TAG, "🔄 Service restarted by system, checking auto-reconnect...")

            if (!isRunning) {
                val prefs = getSharedPreferences("vpn_prefs", MODE_PRIVATE)
                val autoConnectEnabled = prefs.getBoolean("auto_connect_enabled", false)

                if (autoConnectEnabled) {
                    Log.d(TAG, "✅ Auto-reconnect enabled, attempting to reconnect...")

                    val lastProfileId = prefs.getString("last_connected_profile_id", null)
                    if (lastProfileId != null) {
                        Log.d(TAG, "📋 Reconnecting to last profile: $lastProfileId")

                        // Load profile and reconnect
                        try {
                            val profilesStr = prefs.getString("profiles", "[]")
                            val profiles = org.json.JSONArray(profilesStr ?: "[]")

                            for (i in 0 until profiles.length()) {
                                val profile = profiles.getJSONObject(i)
                                if (profile.getString("id") == lastProfileId) {
                                    proxyServer = profile.getString("host")
                                    proxyServerIP = profile.optString("serverIP", proxyServer)
                                    proxyPort = profile.getInt("port")
                                    proxyUsername = profile.optString("username", "")
                                    proxyPassword = profile.optString("password", "")
                                    proxyType = profile.optString("type", "socks5")

                                    Log.d(
                                            TAG,
                                            "🚀 Auto-reconnecting to ${profile.getString("name")}"
                                    )
                                    startVPN()
                                    break
                                }
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "❌ Error during auto-reconnect: ${e.message}", e)
                        }
                    } else {
                        Log.d(TAG, "⚠️ No last connected profile for auto-reconnect")
                    }
                } else {
                    Log.d(TAG, "⏭️ Auto-reconnect disabled")
                }
            }
        }
        return START_STICKY
    }

    private fun startVPN() {
        if (isRunning) {
            Log.w(TAG, "VPN already running")
            return
        }

        try {
            updateNotification("Connecting...")

            val builder = Builder()
            builder.setSession("CBV VPN")
            builder.addAddress("10.0.0.2", 24)

            builder.addRoute("0.0.0.0", 1) // 0.0.0.0/1 = 0.0.0.0 - 127.255.255.255
            builder.addRoute("128.0.0.0", 1) // 128.0.0.0/1 = 128.0.0.0 - 255.255.255.255

            // Use public DNS servers (not DNS-over-TLS)
            builder.addDnsServer("1.1.1.1") // Cloudflare
            builder.addDnsServer("1.0.0.1") // Cloudflare backup
            builder.addDnsServer("8.8.8.8") // Google
            builder.addDnsServer("8.8.4.4") // Google backup

            builder.setMtu(1500)
            builder.setBlocking(false) // Non-blocking mode for better performance

            try {
                builder.addDisallowedApplication(packageName)
            } catch (e: PackageManager.NameNotFoundException) {
                Log.e(TAG, "Failed to exclude application from VPN: ${e.message}")
            }

            Log.d(TAG, "Attempting to establish VPN interface...")
            vpnInterface = builder.establish()

            if (vpnInterface == null) {
                // Check if VPN permission is granted
                val prepareIntent = prepare(this)
                if (prepareIntent != null) {
                    Log.e(TAG, "Failed to establish VPN interface - VPN permission not granted")
                    broadcastStatus(
                            STATUS_DISCONNECTED,
                            error =
                                    "VPN permission not granted. Please open the app and grant VPN permission."
                    )
                } else {
                    Log.e(TAG, "Failed to establish VPN interface - Unknown reason")
                    broadcastStatus(
                            STATUS_DISCONNECTED,
                            error = "Failed to establish VPN interface"
                    )
                }
                stopSelf()
                return
            }

            Log.d(TAG, "✅ VPN interface established successfully")

            connectionStartTime = System.currentTimeMillis()
            isRunning = true
            publicIp = null

            broadcastStatus(STATUS_CONNECTING, force = true)

            // Start packet forwarding thread
            vpnThread = thread(start = true) { runVPNLoop() }

            // Start health check thread for always-on monitoring
            startHealthCheckThread()

            updateNotification("Connected to $proxyServer (handshaking)")
            broadcastStatus(STATUS_HANDSHAKING, force = true)
            startPublicIpCheckThread()
        } catch (e: Exception) {
            Log.e(TAG, "Exception in startVPN(): ${e.message}")
            broadcastStatus(STATUS_DISCONNECTED, force = true, error = e.message)
            stopSelf()
        }
    }

    private fun runVPNLoop() {
        try {
            val inputStream = FileInputStream(vpnInterface!!.fileDescriptor)
            val outputStream = FileOutputStream(vpnInterface!!.fileDescriptor)
            val buffer = ByteArray(32767)

            // Initialize connection manager with SOCKS5 handler
            val proxyHandler =
                    if (proxyType.lowercase() in listOf("socks5", "socks")) {
                        SOCKS5ProxyHandler(
                                proxyServerIP,
                                proxyPort,
                                if (proxyUsername.isNotEmpty()) proxyUsername else null,
                                if (proxyPassword.isNotEmpty()) proxyPassword else null
                        )
                    } else {
                        HTTPProxyHandler(
                                proxyServerIP,
                                proxyPort,
                                if (proxyUsername.isNotEmpty()) proxyUsername else null,
                                if (proxyPassword.isNotEmpty()) proxyPassword else null
                        )
                    }

            connectionManager = ConnectionManager(this, outputStream, proxyHandler)
            udpHandler = UDPHandler(this, outputStream)

            var packetCount = 0
            var emptyReadCount = 0
            lastPacketTime = System.currentTimeMillis() // Initialize health check timer

            while (isRunning) {
                try {
                    val length = inputStream.read(buffer)
                    if (length > 0) {
                        emptyReadCount = 0 // Reset empty read counter
                        packetCount++
                        bytesUp += length
                        lastPacketTime = System.currentTimeMillis() // Update health check timer

                        // Check if packet has TUN header (4 bytes: flags + protocol)
                        var offset = 0
                        if (length > 4) {
                            val firstByte = buffer[0].toInt() and 0xFF
                            val version = (firstByte shr 4) and 0x0F

                            if (version != 4) {
                                offset = 4
                            }
                        }

                        // Parse packet (skip TUN header if present)
                        val parser = PacketParser(buffer, length, offset)

                        if (!parser.isValid) {
                            // Reduce logging frequency for invalid packets
                            if (packetCount % 100 == 0) {
                                Log.w(TAG, "❌ Invalid packet at offset=$offset, length=$length")
                            }
                            continue
                        }

                        // Log first few packets only
                        if (packetCount <= 5) {
                            parser.logSummary()
                        }

                        if (parser.isTCP()) {
                            connectionManager?.handlePacket(parser)
                        } else if (parser.isUDP()) {
                            // Handle DNS queries (port 53)
                            if (parser.destPort == 53) {
                                udpHandler?.handleDNSQuery(parser)
                            } else if (packetCount <= 5) {
                                Log.d(
                                        TAG,
                                        "⚠️ Non-DNS UDP not supported: ${parser.getConnectionKey()}"
                                )
                            }
                        }

                        // Broadcast status update every 500 packets (reduced frequency)
                        if (packetCount % 500 == 0) {
                            broadcastStatus(STATUS_CONNECTED)
                        }
                    } else {
                        // No data available - sleep to prevent busy-wait loop
                        emptyReadCount++
                        // Use exponential backoff: sleep longer if no packets for a while
                        val sleepMs = when {
                            emptyReadCount < 10 -> 1L      // 1ms for first 10 empty reads
                            emptyReadCount < 50 -> 5L      // 5ms for next 40 empty reads
                            else -> 10L                    // 10ms for longer idle periods
                        }
                        Thread.sleep(sleepMs)
                    }
                } catch (e: Exception) {
                    if (isRunning) {
                        Log.e(TAG, "Error in VPN loop: ${e.message}", e)
                        
                        // Check if we should attempt to reconnect
                        val prefs = getSharedPreferences("vpn_prefs", MODE_PRIVATE)
                        val autoConnectEnabled = prefs.getBoolean("auto_connect_enabled", false)
                        val manuallyDisconnected = prefs.getBoolean("manually_disconnected", false)
                        
                        if (autoConnectEnabled && !manuallyDisconnected) {
                            Log.d(TAG, "🔄 VPN loop error but auto-reconnect enabled")
                            // Health check thread will handle reconnection
                        }
                    }
                    break
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Fatal error in VPN loop: ${e.message}", e)
            
            // Check if we should attempt to reconnect
            val prefs = getSharedPreferences("vpn_prefs", MODE_PRIVATE)
            val autoConnectEnabled = prefs.getBoolean("auto_connect_enabled", false)
            val manuallyDisconnected = prefs.getBoolean("manually_disconnected", false)
            
            if (autoConnectEnabled && !manuallyDisconnected) {
                Log.d(TAG, "🔄 Fatal VPN error but auto-reconnect enabled")
                // Health check thread will detect the dead connection and restart
            }
        } finally {
            connectionManager?.closeAll()
            connectionManager = null
            udpHandler = null
        }
    }

    private fun startHealthCheckThread() {
        healthCheckThread?.interrupt()
        healthCheckThread = thread(name = "vpn-health-check", start = true) {
            try {
                Log.d(TAG, "🏥 Health check thread started")
                var healthCheckCycle = 0
                
                while (isRunning) {
                    Thread.sleep(HEALTH_CHECK_INTERVAL_MS)
                    
                    if (!isRunning) break
                    
                    healthCheckCycle++
                    val timeSinceLastPacket = System.currentTimeMillis() - lastPacketTime
                    
                    Log.d(TAG, "🏥 Health check #$healthCheckCycle: ${timeSinceLastPacket}ms since last packet")
                    
                    if (timeSinceLastPacket > CONNECTION_TIMEOUT_MS) {
                        Log.w(TAG, "⚠️ VPN connection appears dead (no packets for ${timeSinceLastPacket}ms)")
                        
                        // Check if auto-reconnect is enabled
                        val prefs = getSharedPreferences("vpn_prefs", MODE_PRIVATE)
                        val autoConnectEnabled = prefs.getBoolean("auto_connect_enabled", false)
                        val manuallyDisconnected = prefs.getBoolean("manually_disconnected", false)
                        
                        if (autoConnectEnabled && !manuallyDisconnected) {
                            Log.d(TAG, "🔄 Auto-reconnect enabled, attempting to restart VPN...")
                            
                            // Save current connection details
                            val savedServer = proxyServer
                            val savedServerIP = proxyServerIP
                            val savedPort = proxyPort
                            val savedUsername = proxyUsername
                            val savedPassword = proxyPassword
                            val savedType = proxyType
                            
                            // Stop current connection
                            stopVPNInternal()
                            
                            // Wait a bit before reconnecting
                            Thread.sleep(2000)
                            
                            // Restore connection details
                            proxyServer = savedServer
                            proxyServerIP = savedServerIP
                            proxyPort = savedPort
                            proxyUsername = savedUsername
                            proxyPassword = savedPassword
                            proxyType = savedType
                            
                            // Restart VPN
                            Log.d(TAG, "🚀 Restarting VPN connection to $proxyServer:$proxyPort")
                            startVPN()
                        } else {
                            Log.d(TAG, "⏭️ Auto-reconnect disabled or manually disconnected, stopping VPN")
                            stopVPNInternal()
                            stopSelf()
                        }
                        break
                    } else {
                        Log.d(TAG, "✅ VPN connection is healthy")
                    }
                }
                Log.d(TAG, "🏥 Health check thread ended")
            } catch (e: InterruptedException) {
                Log.d(TAG, "🏥 Health check thread interrupted")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error in health check thread: ${e.message}", e)
            }
        }
    }

    private fun stopVPNInternal() {
        Log.d(TAG, "🛑 Stopping VPN internal...")
        isRunning = false

        // Stop health check thread
        healthCheckThread?.interrupt()
        healthCheckThread = null

        connectionManager?.closeAll()
        connectionManager = null

        vpnThread?.interrupt()
        vpnThread = null

        vpnInterface?.close()
        vpnInterface = null

        connectionStartTime = 0L
        bytesUp = 0L
        bytesDown = 0L
        publicIp = null
        lastPacketTime = 0L

        publicIpCheckThread?.interrupt()
        publicIpCheckThread = null
    }

    private fun stopVPN() {
        stopVPNInternal()
        broadcastStatus(STATUS_DISCONNECTED, force = true)
        stopForeground(true)
        stopSelf()
    }

    private fun broadcastStatus(
            status: String,
            force: Boolean = false,
            error: String? = null,
            publicIpOverride: String? = null
    ) {
        val intent = Intent(ACTION_VPN_STATUS)
        intent.putExtra(EXTRA_STATUS, status)
        intent.putExtra(EXTRA_IS_CONNECTED, status == STATUS_CONNECTED)
        intent.putExtra(EXTRA_DURATION, getConnectionDuration())
        intent.putExtra(EXTRA_BYTES_UP, bytesUp)
        intent.putExtra(EXTRA_BYTES_DOWN, bytesDown)
        if (!error.isNullOrEmpty()) {
            intent.putExtra(EXTRA_ERROR, error)
        }
        val ipToSend = publicIpOverride ?: publicIp
        if (!ipToSend.isNullOrEmpty()) {
            intent.putExtra(EXTRA_PUBLIC_IP, ipToSend)
        }

        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    private fun startPublicIpCheckThread() {
        publicIpCheckThread?.interrupt()
        publicIpCheckThread = thread(name = "public-ip-check", start = true) {
            try {
                Log.d(TAG, "🚀 Starting public IP check thread...")
                // Wait a bit for VPN to stabilize
                Thread.sleep(2000)

                while (isRunning) {
                    try {
                        val fetchedIp = fetchPublicIpViaProxy()
                        if (fetchedIp != null) {
                            // Only update if IP changed or it's the first fetch
                            if (publicIp != fetchedIp) {
                                publicIp = fetchedIp
                                Log.d(TAG, "✅ Public IP via proxy: $fetchedIp")
                                updateNotification("Connected to $proxyServer ($fetchedIp)")
                                broadcastStatus(STATUS_CONNECTED, force = true, publicIpOverride = fetchedIp)
                            } else {
                                Log.d(TAG, "ℹ️ Public IP unchanged: $fetchedIp")
                            }
                        } else {
                            Log.w(TAG, "⚠️ Unable to determine public IP via proxy")
                            // Don't clear existing IP if check fails, just log it
                            if (publicIp == null) {
                                updateNotification("Connected to $proxyServer")
                                broadcastStatus(STATUS_CONNECTED, force = true)
                            }
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ Error in public IP check loop: ${e.message}", e)
                    }

                    // Wait for next check
                    Thread.sleep(PUBLIC_IP_CHECK_INTERVAL_MS)
                }
            } catch (e: InterruptedException) {
                Log.d(TAG, "🛑 Public IP check thread interrupted")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Fatal error in public IP check thread: ${e.message}", e)
            }
        }
    }

    private fun fetchPublicIpViaProxy(): String? {
        var socket: java.net.Socket? = null
        var sslSocket: SSLSocket? = null
        try {
            Log.d(TAG, "🌐 Fetching public IP via proxy...")
            Log.d(TAG, "📍 Proxy details: $proxyType://$proxyServerIP:$proxyPort")

            // Create socket and connect to proxy
            socket = java.net.Socket()
            socket.soTimeout = 10000
            socket.tcpNoDelay = true
            socket.keepAlive = true

            if (!protect(socket)) {
                Log.w(
                        TAG,
                        "⚠️ Failed to protect public IP socket (may still work if already protected)"
                )
            } else {
                Log.d(TAG, "✅ Socket protected successfully")
            }

            // Create proxy handler
            val proxyHandler =
                    if (proxyType.lowercase() in listOf("socks5", "socks")) {
                        SOCKS5ProxyHandler(
                                proxyServerIP,
                                proxyPort,
                                if (proxyUsername.isNotEmpty()) proxyUsername else null,
                                if (proxyPassword.isNotEmpty()) proxyPassword else null
                        )
                    } else {
                        HTTPProxyHandler(
                                proxyServerIP,
                                proxyPort,
                                if (proxyUsername.isNotEmpty()) proxyUsername else null,
                                if (proxyPassword.isNotEmpty()) proxyPassword else null
                        )
                    }

            val targetHost = "api.ipify.org"
            val targetPort = 443

            // Connect to target host via proxy
            Log.d(TAG, "📞 Connecting to $targetHost:$targetPort via $proxyType proxy...")
            val connected = proxyHandler.connect(targetHost, targetPort, socket)
            if (!connected) {
                Log.e(TAG, "❌ Failed to connect to $targetHost via proxy")
                Log.e(TAG, "❌ This usually means proxy blocked the CONNECT request or auth failed")
                return null
            }
            Log.d(TAG, "✅ Connected to $targetHost via proxy, performing TLS handshake...")

            val sslSocketFactory = SSLSocketFactory.getDefault() as SSLSocketFactory
            sslSocket =
                    sslSocketFactory.createSocket(socket, targetHost, targetPort, true) as SSLSocket
            sslSocket.soTimeout = 10000
            sslSocket.enabledProtocols =
                    sslSocket.supportedProtocols.filter { it.startsWith("TLS") }.toTypedArray()

            sslSocket.startHandshake()
            Log.d(TAG, "🤝 TLS handshake completed with $targetHost")

            val output = sslSocket.outputStream
            val request = buildString {
                append("GET /?format=json HTTP/1.1\r\n")
                append("Host: $targetHost\r\n")
                append("User-Agent: CBV-VPN/1.0\r\n")
                append("Accept: application/json\r\n")
                append("Connection: close\r\n")
                append("\r\n")
            }

            output.write(request.toByteArray(Charsets.UTF_8))
            output.flush()

            val reader =
                    java.io.BufferedReader(
                            java.io.InputStreamReader(sslSocket.inputStream, Charsets.UTF_8)
                    )

            var line: String?
            var contentLength = 0
            var isChunked = false
            while (reader.readLine().also { line = it } != null) {
                if (line!!.isEmpty()) break
                if (line!!.startsWith("Content-Length:", ignoreCase = true)) {
                    contentLength = line!!.substring(15).trim().toIntOrNull() ?: 0
                }
                if (line!!.startsWith("Transfer-Encoding:", ignoreCase = true) &&
                                line!!.contains("chunked", true)
                ) {
                    isChunked = true
                }
            }

            val body =
                    when {
                        contentLength > 0 -> {
                            val buffer = CharArray(contentLength)
                            var totalRead = 0
                            while (totalRead < contentLength) {
                                val read = reader.read(buffer, totalRead, contentLength - totalRead)
                                if (read == -1) break
                                totalRead += read
                            }
                            String(buffer, 0, totalRead)
                        }
                        isChunked -> {
                            val sb = StringBuilder()
                            while (true) {
                                val chunkSizeLine = reader.readLine() ?: break
                                val chunkSize = chunkSizeLine.trim().toIntOrNull(16) ?: break
                                if (chunkSize == 0) {
                                    reader.readLine() // consume trailing CRLF
                                    break
                                }
                                val chunkBuffer = CharArray(chunkSize)
                                var readTotal = 0
                                while (readTotal < chunkSize) {
                                    val read =
                                            reader.read(
                                                    chunkBuffer,
                                                    readTotal,
                                                    chunkSize - readTotal
                                            )
                                    if (read == -1) break
                                    readTotal += read
                                }
                                sb.append(chunkBuffer, 0, readTotal)
                                reader.readLine() // CRLF after chunk
                            }
                            sb.toString()
                        }
                        else -> reader.readText()
                    }

            Log.d(TAG, "📡 Response from $targetHost: ${body.trim()}")

            val json = JSONObject(body.trim())
            val ip = json.optString("ip", null)

            if (!ip.isNullOrEmpty()) {
                Log.d(TAG, "📡 Public IP via proxy: $ip")
                return ip
            }

            Log.e(TAG, "❌ Failed to parse public IP from response: ${body.trim()}")
            return null
        } catch (e: java.net.SocketTimeoutException) {
            Log.e(TAG, "❌ Timeout fetching public IP via proxy: ${e.message}")
            Log.e(TAG, "❌ Proxy may be slow or blocking the request")
            return null
        } catch (e: java.net.ConnectException) {
            Log.e(TAG, "❌ Connection refused fetching public IP: ${e.message}")
            Log.e(TAG, "❌ Proxy may not be reachable or port is wrong")
            return null
        } catch (e: javax.net.ssl.SSLException) {
            Log.e(TAG, "❌ SSL/TLS error fetching public IP: ${e.message}")
            Log.e(TAG, "❌ TLS handshake failed with api.ipify.org")
            e.printStackTrace()
            return null
        } catch (e: Exception) {
            Log.e(
                    TAG,
                    "❌ Error fetching public IP via proxy: ${e.javaClass.simpleName} - ${e.message}"
            )
            e.printStackTrace()
            return null
        } finally {
            try {
                sslSocket?.close()
                socket?.close()
            } catch (e: Exception) {
                // Ignore
            }
        }
    }

    private fun getConnectionDuration(): Long {
        return if (connectionStartTime == 0L) 0L
        else System.currentTimeMillis() - connectionStartTime
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel =
                    NotificationChannel(
                            CHANNEL_ID,
                            "VPN Service",
                            NotificationManager.IMPORTANCE_LOW
                    )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun createNotification(status: String): Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        
        // Use FLAG_IMMUTABLE on Android 12+ (required), FLAG_UPDATE_CURRENT on older versions
        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, pendingIntentFlags)

        // Create stop intent
        val stopIntent = Intent(this, VPNConnectionService::class.java)
        stopIntent.putExtra("action", COMMAND_STOP)
        val stopPendingIntent =
                PendingIntent.getService(
                        this,
                        1,
                        stopIntent,
                        pendingIntentFlags
                )

        // Only show stop button when VPN is fully connected (not connecting or handshaking)
        val isConnected = status.startsWith("Connected to") && !status.contains("handshaking")

        val builder =
                NotificationCompat.Builder(this, CHANNEL_ID)
                        .setContentTitle("CBV VPN")
                        .setContentText(status)
                        .setSmallIcon(android.R.drawable.ic_lock_lock)
                        .setContentIntent(pendingIntent)
                        .setOngoing(true)

        // Only add stop button when VPN is connected
        if (isConnected) {
            builder.addAction(android.R.drawable.ic_media_pause, "Stop", stopPendingIntent)
        }

        return builder.build()
    }

    private fun updateNotification(status: String) {
        val notification = createNotification(status)
        val manager = getSystemService(NotificationManager::class.java)
        manager?.notify(NOTIFICATION_ID, notification)
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "🔚 VPNConnectionService onDestroy() called")
        try {
            LocalBroadcastManager.getInstance(this).unregisterReceiver(bytesReceivedReceiver)
        } catch (e: Exception) {
            Log.w(TAG, "Error unregistering receiver: ${e.message}")
        }
        
        // Stop health check thread
        healthCheckThread?.interrupt()
        healthCheckThread = null
        
        stopVPN()
    }

    override fun onRevoke() {
        super.onRevoke()
        Log.w(TAG, "⚠️ VPN permission revoked by user or system")
        
        // Mark as manually disconnected since user revoked permission
        val prefs = getSharedPreferences("vpn_prefs", MODE_PRIVATE)
        prefs.edit().putBoolean("manually_disconnected", true).apply()
        
        stopVPN()
    }
}
