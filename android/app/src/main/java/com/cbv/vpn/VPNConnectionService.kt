package com.cbv.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
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
    
    private val bytesReceivedReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
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
        val notification = createNotification("VPN Service")
        startForeground(NOTIFICATION_ID, notification)
        
        // Register receiver for bytes received from connections
        val filter = android.content.IntentFilter("com.cbv.vpn.BYTES_RECEIVED")
        registerReceiver(bytesReceivedReceiver, filter)
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent != null) {
            val action = intent.getStringExtra("action")
            
            if (action == COMMAND_STOP) {
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
            
            startVPN()
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
            
            builder.addRoute("0.0.0.0", 1)  // 0.0.0.0/1 = 0.0.0.0 - 127.255.255.255
            builder.addRoute("128.0.0.0", 1) // 128.0.0.0/1 = 128.0.0.0 - 255.255.255.255
            
            // Use public DNS servers (not DNS-over-TLS)
            builder.addDnsServer("1.1.1.1")  // Cloudflare
            builder.addDnsServer("1.0.0.1")  // Cloudflare backup
            builder.addDnsServer("8.8.8.8")  // Google
            builder.addDnsServer("8.8.4.4")  // Google backup
            
            builder.setMtu(1500)
            builder.setBlocking(false)  // Non-blocking mode for better performance

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
                    broadcastStatus(STATUS_DISCONNECTED, error = "VPN permission not granted. Please open the app and grant VPN permission.")
                } else {
                    Log.e(TAG, "Failed to establish VPN interface - Unknown reason")
                    broadcastStatus(STATUS_DISCONNECTED, error = "Failed to establish VPN interface")
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
            vpnThread = thread(start = true) {
                runVPNLoop()
            }
            
            updateNotification("Connected to $proxyServer (handshaking)")
            broadcastStatus(STATUS_HANDSHAKING, force = true)
            fetchPublicIpAsync()

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
            val proxyHandler = if (proxyType.lowercase() in listOf("socks5", "socks")) {
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
            
            while (isRunning) {
                try {
                    val length = inputStream.read(buffer)
                    if (length > 0) {
                        packetCount++
                        bytesUp += length
                        
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
                            Log.w(TAG, "❌ Invalid packet at offset=$offset, length=$length")
                            continue
                        }
                        
                        // Log first few packets
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
                                Log.d(TAG, "⚠️ Non-DNS UDP not supported: ${parser.getConnectionKey()}")
                            }
                        }
                        
                        // Broadcast status update every 100 packets
                        if (packetCount % 100 == 0) {
                            broadcastStatus(STATUS_CONNECTED)
                        }
                    }
                } catch (e: Exception) {
                    if (isRunning) {
                        Log.e(TAG, "Error in VPN loop: ${e.message}")
                    }
                    break
                }
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Fatal error in VPN loop: ${e.message}")
        } finally {
            connectionManager?.closeAll()
            connectionManager = null
            udpHandler = null
        }
    }

    private fun stopVPN() {
        isRunning = false
        
        connectionManager?.closeAll()
        connectionManager = null
        
        vpnThread?.interrupt()
        vpnThread = null
        
        vpnInterface?.close()
        vpnInterface = null
        
        broadcastStatus(STATUS_DISCONNECTED, force = true)
        
        connectionStartTime = 0L
        bytesUp = 0L
        bytesDown = 0L
        publicIp = null
        
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

    private fun fetchPublicIpAsync() {
        thread(name = "public-ip-fetch", start = true) {
            try {
                Log.d(TAG, "🚀 Starting public IP fetch thread...")
                // Wait a bit for VPN to stabilize
                Thread.sleep(2000)

                broadcastStatus(STATUS_HANDSHAKING, force = true)
                
                val fetchedIp = fetchPublicIpViaProxy()
                if (fetchedIp != null) {
                    publicIp = fetchedIp
                    Log.d(TAG, "✅ Public IP via proxy: $fetchedIp")
                    updateNotification("Connected to $proxyServer ($fetchedIp)")
                    broadcastStatus(STATUS_CONNECTED, force = true, publicIpOverride = fetchedIp)
                } else {
                    Log.w(TAG, "⚠️ Unable to determine public IP via proxy")
                    updateNotification("Connected to $proxyServer")
                    broadcastStatus(STATUS_CONNECTED, force = true)
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error in fetchPublicIpAsync: ${e.message}", e)
                updateNotification("Connected to $proxyServer")
                broadcastStatus(STATUS_CONNECTED, force = true)
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
                Log.w(TAG, "⚠️ Failed to protect public IP socket (may still work if already protected)")
            } else {
                Log.d(TAG, "✅ Socket protected successfully")
            }
            
            // Create proxy handler
            val proxyHandler = if (proxyType.lowercase() in listOf("socks5", "socks")) {
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
            sslSocket = sslSocketFactory.createSocket(socket, targetHost, targetPort, true) as SSLSocket
            sslSocket.soTimeout = 10000
            sslSocket.enabledProtocols = sslSocket.supportedProtocols.filter { it.startsWith("TLS") }.toTypedArray()

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

            val reader = java.io.BufferedReader(java.io.InputStreamReader(sslSocket.inputStream, Charsets.UTF_8))

            var line: String?
            var contentLength = 0
            var isChunked = false
            while (reader.readLine().also { line = it } != null) {
                if (line!!.isEmpty()) break
                if (line!!.startsWith("Content-Length:", ignoreCase = true)) {
                    contentLength = line!!.substring(15).trim().toIntOrNull() ?: 0
                }
                if (line!!.startsWith("Transfer-Encoding:", ignoreCase = true) && line!!.contains("chunked", true)) {
                    isChunked = true
                }
            }

            val body = when {
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
                            val read = reader.read(chunkBuffer, readTotal, chunkSize - readTotal)
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
            Log.e(TAG, "❌ Error fetching public IP via proxy: ${e.javaClass.simpleName} - ${e.message}")
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
        return if (connectionStartTime == 0L) 0L else System.currentTimeMillis() - connectionStartTime
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
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
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CBV VPN")
            .setContentText(status)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
    
    private fun updateNotification(status: String) {
        val notification = createNotification(status)
        val manager = getSystemService(NotificationManager::class.java)
        manager?.notify(NOTIFICATION_ID, notification)
    }
    
    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(bytesReceivedReceiver)
        } catch (e: Exception) {
            Log.w(TAG, "Error unregistering receiver: ${e.message}")
        }
        stopVPN()
    }
    
    override fun onRevoke() {
        super.onRevoke()
        stopVPN()
    }
}
