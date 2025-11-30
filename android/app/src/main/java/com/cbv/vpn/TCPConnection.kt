package com.cbv.vpn

import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.VpnService
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import java.io.FileDescriptor
import java.io.FileOutputStream
import java.net.InetSocketAddress
import java.net.Socket
import kotlin.concurrent.thread

/**
 * Manage a single TCP connection through proxy
 */
class TCPConnection(
    private val parser: PacketParser,
    private val vpnService: VpnService,
    private val vpnOutput: FileOutputStream,
    private val proxyHandler: ProxyHandler
) {
    
    private val TAG = "TCPConnection"
    private val connectionKey = parser.getConnectionKey()
    
    private var socket: Socket? = null
    private var isConnected = false
    private var isClosed = false
    private var proxyReaderStarted = false
    private var socketBypassedVpn = false
    
    private var localSeqNumber = (System.currentTimeMillis() and 0xFFFFFFFF).toLong()
    private var remoteSeqNumber = 0L
    private var remoteAckNumber = 0L
    private var lastAckSent = 0L
    
    private val sendBuffer = mutableListOf<ByteArray>()
    private var totalBytesReceived = 0L
    private var totalBytesSent = 0L

    companion object {
        const val ACTION_PROXY_ERROR = "com.cbv.vpn.PROXY_ERROR"
        const val ACTION_PROXY_SUCCESS = "com.cbv.vpn.PROXY_SUCCESS"
        const val EXTRA_ERROR_MESSAGE = "error_message"
    }

    private fun broadcastProxyError(errorMessage: String) {
        try {
            val intent = Intent(ACTION_PROXY_ERROR)
            intent.putExtra(EXTRA_ERROR_MESSAGE, errorMessage)
            LocalBroadcastManager.getInstance(vpnService).sendBroadcast(intent)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to broadcast proxy error: ${e.message}")
        }
    }

    private fun broadcastProxySuccess() {
        try {
            val intent = Intent(ACTION_PROXY_SUCCESS)
            LocalBroadcastManager.getInstance(vpnService).sendBroadcast(intent)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to broadcast proxy success: ${e.message}")
        }
    }
    
    fun handlePacket(parser: PacketParser) {
        try {
            when {
                parser.isSYN() -> handleSYN(parser)
                parser.isFIN() -> handleFIN(parser)
                parser.isRST() -> handleRST(parser)
                parser.isACK() && parser.payloadLength > 0 -> handleData(parser)
                parser.isACK() -> handleACK(parser)
                else -> Log.d(TAG, "⚠️ Unhandled packet flags: ${parser.tcpFlags}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error handling packet: ${e.message}")
            close()
        }
    }

    private fun createBypassedSocket(): Pair<Socket, Boolean> {
        val connectivityManager = vpnService.getSystemService(ConnectivityManager::class.java)
        val networks = connectivityManager?.allNetworks ?: emptyArray()
        for (network in networks) {
            try {
                val caps = connectivityManager?.getNetworkCapabilities(network)
                if (caps != null && !caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) {
                    val socket = network.socketFactory.createSocket()
                    if (socket != null) {
                        val transports = buildList {
                            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) add("cellular")
                            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) add("wifi")
                            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) add("ethernet")
                            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH)) add("bluetooth")
                            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) add("vpn")
                            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_LOWPAN)) add("lowpan")
                            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI_AWARE)) add("wifi_aware")
                            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_USB)) add("usb")
                        }.joinToString(",")
                        Log.d(TAG, "   Created socket on network: $network transports=[$transports]")
                        return socket to true
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "⚠️ Failed to create socket on network $network: ${e.message}")
            }
        }
        Log.w(TAG, "⚠️ Falling back to default Socket (may require protect())")
        return Socket() to false
    }

    private fun protectSocket(socket: Socket?): Boolean {
        if (socket == null) return false
        return try {
            if (vpnService.protect(socket)) {
                return true
            }
            // Fallback: try protecting underlying file descriptor via reflection
            val implField = Socket::class.java.getDeclaredField("impl").apply { isAccessible = true }
            val socketImpl = implField.get(socket) ?: return false
            val fdField = socketImpl.javaClass.getDeclaredField("fd").apply { isAccessible = true }
            val fd = fdField.get(socketImpl) as? FileDescriptor ?: return false
            val descriptorField = FileDescriptor::class.java.getDeclaredField("descriptor").apply { isAccessible = true }
            val rawFd = descriptorField.getInt(fd)
            val fdProtected = vpnService.protect(rawFd)
            Log.d(TAG, "   protect(fd=$rawFd) result: $fdProtected")
            fdProtected
        } catch (e: Exception) {
            Log.e(TAG, "   protectSocket fallback failed: ${e.message}")
            false
        }
    }
    
    private fun handleSYN(parser: PacketParser) {
        Log.d(TAG, "🔌 SYN received: ${parser.getConnectionKey()}")
        
        remoteSeqNumber = parser.sequenceNumber
        remoteAckNumber = parser.sequenceNumber + 1
        lastAckSent = remoteAckNumber
        
        // Create and protect socket BEFORE sending SYN-ACK
        val (createdSocket, bypassed) = createBypassedSocket()
        socket = createdSocket
        socketBypassedVpn = bypassed
        
        Log.d(TAG, "   Socket created: bound=${socket?.isBound}, connected=${socket?.isConnected}")
        Log.d(TAG, "   VpnService: ${vpnService.javaClass.simpleName}")
        
        val protected = if (socketBypassedVpn) {
            Log.d(TAG, "   Socket created on non-VPN network, skipping protect()")
            true
        } else {
            protectSocket(socket)
        }
        Log.d(TAG, "   protect() result: $protected")
        if (!protected) {
            Log.w(TAG, "⚠️ Socket protection failed - connection will loop through VPN")
        } else {
            Log.d(TAG, "✅ Socket ready in handleSYN")
        }
        
        // Send SYN-ACK
        val synAck = PacketBuilder.buildSYNACKPacket(parser, localSeqNumber)
        writeToVPN(synAck)
        
        localSeqNumber++
        
        Log.d(TAG, "📤 Sent SYN-ACK")
        
        // Connect to proxy in background (socket already protected)
        thread(start = true, name = "tcp-connect-$connectionKey") {
            connectToProxy(parser)
        }
    }
    
    private fun connectToProxy(parser: PacketParser) {
        try {
            Log.d(TAG, "🔗 Connecting to proxy for ${parser.destAddress}:${parser.destPort}")
            
            // Socket already created and protected in handleSYN
            if (socket == null) {
                Log.e(TAG, "❌ Socket is null in connectToProxy")
                broadcastProxyError("Socket is null - cannot connect to proxy")
                sendRST(parser)
                return
            }
            
            Log.d(TAG, "   Using pre-protected socket")
            
            val proxyHostToCheck = when (proxyHandler) {
                is HTTPProxyHandler -> proxyHandler.proxyHost
                is SOCKS5ProxyHandler -> proxyHandler.proxyHost
                else -> ""
            }
            val proxyPortToCheck = when (proxyHandler) {
                is HTTPProxyHandler -> proxyHandler.proxyPort
                is SOCKS5ProxyHandler -> proxyHandler.proxyPort
                else -> 0
            }
            
            val isDirectProxyTarget = parser.destAddress == proxyHostToCheck &&
                parser.destPort == proxyPortToCheck
            
            if (isDirectProxyTarget) {
                Log.d(TAG, "ℹ️ Destination is proxy itself - skipping CONNECT and bridging directly")
                if (!connectDirectly(parser)) {
                    Log.e(TAG, "❌ Failed to establish direct connection to proxy")
                    broadcastProxyError("Failed to connect directly to proxy server")
                    sendRST(parser)
                    return
                }
            } else {
                // Connect through proxy
                val success = proxyHandler.connect(
                    parser.destAddress,
                    parser.destPort,
                    socket!!
                )
                
                if (!success) {
                    Log.e(TAG, "❌ Failed to connect through proxy")
                    broadcastProxyError("Proxy connection failed for ${parser.destAddress}:${parser.destPort}")
                    sendRST(parser)
                    return
                }
                
                // Connection successful - notify recovery
                broadcastProxySuccess()
                onConnected(parser)
                Log.d(TAG, "✅ Connected to ${parser.destAddress}:${parser.destPort} via proxy")
            }
            
            // Start reading from proxy (already started inside onConnected/direct path)
            
        } catch (e: java.net.ConnectException) {
            Log.e(TAG, "❌ Proxy connection refused: ${e.message}")
            broadcastProxyError("Proxy server connection refused")
            sendRST(parser)
        } catch (e: java.net.SocketTimeoutException) {
            Log.e(TAG, "❌ Proxy connection timeout: ${e.message}")
            broadcastProxyError("Proxy server connection timeout")
            sendRST(parser)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error connecting to proxy: ${e.message}")
            broadcastProxyError("Proxy error: ${e.message}")
            sendRST(parser)
        }
    }

    private fun connectDirectly(parser: PacketParser): Boolean {
        return try {
            val targetAddress = InetSocketAddress(parser.destAddress, parser.destPort)
            if (socket?.isConnected != true) {
                socket?.connect(targetAddress, 10_000)
            }
            if (socket?.isConnected == true) {
                Log.d(TAG, "✅ Direct TCP connection established to ${parser.destAddress}:${parser.destPort}")
                onConnected(parser)
                true
            } else {
                Log.e(TAG, "❌ Direct connection established but socket reports disconnected")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error during direct connection: ${e.message}")
            false
        }
    }

    private fun onConnected(parser: PacketParser) {
        if (isConnected) return
        
        Log.d(TAG, "✅ Connection ready for ${parser.destAddress}:${parser.destPort}")
        
        // Start proxy reader BEFORE marking as connected to avoid race condition
        if (!proxyReaderStarted) {
            proxyReaderStarted = true
            startProxyReader()
        }
        
        // Small delay to ensure reader thread is ready
        Thread.sleep(50)
        
        // Now mark as connected and flush buffer
        isConnected = true
        
        synchronized(sendBuffer) {
            if (sendBuffer.isNotEmpty()) {
                Log.d(TAG, "📤 Flushing ${sendBuffer.size} buffered packets")
                sendBuffer.forEach { data ->
                    try {
                        socket?.getOutputStream()?.write(data)
                        totalBytesSent += data.size
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ Error flushing buffered data: ${e.message}")
                        sendBuffer.clear()
                        close()
                        return
                    }
                }
                try {
                    socket?.getOutputStream()?.flush()
                    Log.d(TAG, "✅ Flushed all buffered data successfully")
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error flushing stream: ${e.message}")
                }
            }
            sendBuffer.clear()
        }
    }
    
    private var packetCounter = 0
    
    private fun handleData(parser: PacketParser) {
        packetCounter++
        // Reduce logging frequency - only log every 100th packet or first few
        if (packetCounter <= 5 || packetCounter % 100 == 0) {
            Log.d(TAG, "📥 Data received: ${parser.payloadLength} bytes (seq=${parser.sequenceNumber})")
        }
        
        // Check for duplicate or out-of-order packets
        val expectedSeq = remoteAckNumber
        if (expectedSeq > 0 && parser.sequenceNumber != expectedSeq) {
            // Only log out-of-order packets occasionally
            if (packetCounter % 50 == 0) {
                Log.w(TAG, "⚠️ Out-of-order packet: expected seq=$expectedSeq, got=${parser.sequenceNumber}")
            }
            // Re-send last ACK for duplicate packets
            if (parser.sequenceNumber < expectedSeq) {
                val ack = PacketBuilder.buildACKPacket(parser, localSeqNumber, lastAckSent)
                writeToVPN(ack)
                return
            }
        }
        
        remoteSeqNumber = parser.sequenceNumber
        remoteAckNumber = parser.sequenceNumber + parser.payloadLength
        lastAckSent = remoteAckNumber
        
        val payload = parser.getPayload()
        
        if (isConnected && socket?.isConnected == true) {
            // Send to proxy
            try {
                socket?.getOutputStream()?.write(payload)
                socket?.getOutputStream()?.flush() // Force flush for HTTP proxies
                totalBytesSent += payload.size
                // Reduce logging frequency
                if (packetCounter <= 5 || packetCounter % 100 == 0) {
                    Log.d(TAG, "📤 Sent ${payload.size} bytes to proxy (total: $totalBytesSent)")
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error sending to proxy: ${e.message}")
                sendRST(parser)
                close()
                return
            }
        } else {
            // Buffer data until connected
            synchronized(sendBuffer) {
                sendBuffer.add(payload)
                // Only log buffer status occasionally
                if (sendBuffer.size % 10 == 0 || sendBuffer.size == 1) {
                    Log.d(TAG, "📦 Buffered ${payload.size} bytes (waiting for connection, buffer size: ${sendBuffer.size})")
                }
            }
        }
        
        // Send ACK
        val ack = PacketBuilder.buildACKPacket(parser, localSeqNumber, remoteAckNumber)
        writeToVPN(ack)
    }
    
    private fun handleACK(parser: PacketParser) {
        // Just update sequence numbers
        remoteSeqNumber = parser.sequenceNumber
    }
    
    private fun handleFIN(parser: PacketParser) {
        Log.d(TAG, "👋 FIN received")
        
        remoteSeqNumber = parser.sequenceNumber
        remoteAckNumber = parser.sequenceNumber + 1
        
        // Send FIN-ACK
        val finAck = PacketBuilder.buildFINACKPacket(parser, localSeqNumber, remoteAckNumber)
        writeToVPN(finAck)
        
        localSeqNumber++
        
        close()
    }
    
    private fun handleRST(parser: PacketParser) {
        Log.d(TAG, "🛑 RST received")
        close()
    }
    
    private fun startProxyReader() {
        thread(start = true, name = "proxy-reader-$connectionKey") {
            try {
                val inputStream = socket?.getInputStream()
                val buffer = ByteArray(16384) // Increased buffer size
                
                // Set read timeout to detect stale connections
                socket?.soTimeout = 60_000
                
                Log.d(TAG, "🔄 Proxy reader started for $connectionKey")
                
                var readCounter = 0
                while (!isClosed && socket?.isConnected == true) {
                    val length = try {
                        inputStream?.read(buffer) ?: -1
                    } catch (e: java.net.SocketTimeoutException) {
                        // Timeout reading - connection might be stale
                        // Reduce logging frequency for timeouts
                        if (readCounter % 100 == 0) {
                            Log.w(TAG, "⏱️ Read timeout (connection idle)")
                        }
                        continue
                    }
                    
                    if (length <= 0) {
                        Log.d(TAG, "📭 Proxy closed connection (read=$length)")
                        break
                    }
                    
                    readCounter++
                    totalBytesReceived += length
                    // Reduce logging frequency - only log every 100th read or first few
                    if (readCounter <= 5 || readCounter % 100 == 0) {
                        Log.d(TAG, "📬 Received $length bytes from proxy (total: $totalBytesReceived)")
                    }
                    
                    // Send to VPN in chunks if needed
                    val payload = buffer.copyOfRange(0, length)
                    
                    synchronized(this@TCPConnection) {
                        val packet = PacketBuilder.buildACKPacket(
                            parser,
                            localSeqNumber,
                            remoteAckNumber,
                            payload
                        )
                        
                        writeToVPN(packet)
                        localSeqNumber += length
                    }
                    
                    // Notify service about bytes received
                    notifyBytesReceived(length.toLong())
                }
                
            } catch (e: Exception) {
                if (!isClosed) {
                    Log.e(TAG, "❌ Error reading from proxy: ${e.message}")
                }
            } finally {
                Log.d(TAG, "🔌 Proxy reader stopped (sent: $totalBytesSent, received: $totalBytesReceived)")
                close()
            }
        }
    }
    
    private fun notifyBytesReceived(bytes: Long) {
        try {
            // Notify VPN service about bytes received (local broadcast)
            val intent = android.content.Intent("com.cbv.vpn.BYTES_RECEIVED")
            intent.putExtra("bytes", bytes)
            androidx.localbroadcastmanager.content.LocalBroadcastManager.getInstance(vpnService).sendBroadcast(intent)
        } catch (e: Exception) {
            // Ignore broadcast errors
        }
    }
    
    private fun sendRST(parser: PacketParser) {
        val rst = PacketBuilder.buildRSTPacket(parser)
        writeToVPN(rst)
        close()
    }
    
    private fun writeToVPN(packet: ByteArray) {
        try {
            synchronized(vpnOutput) {
                vpnOutput.write(packet)
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error writing to VPN: ${e.message}")
        }
    }
    
    fun close() {
        if (isClosed) return
        
        isClosed = true
        isConnected = false
        
        try {
            socket?.close()
            Log.d(TAG, "🔌 Connection closed: $connectionKey")
        } catch (e: Exception) {
            Log.e(TAG, "Error closing socket: ${e.message}")
        }
    }
}
