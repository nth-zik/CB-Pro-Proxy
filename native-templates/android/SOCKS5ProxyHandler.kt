package com.cbv.vpn

import android.util.Log
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket

/**
 * Handle SOCKS5 proxy connections
 */
class SOCKS5ProxyHandler(
    val proxyHost: String,
    val proxyPort: Int,
    private val username: String?,
    private val password: String?
) : ProxyHandler {
    
    private val TAG = "SOCKS5ProxyHandler"
    
    override fun connect(targetHost: String, targetPort: Int, socket: Socket): Boolean {
        try {
            Log.d(TAG, "Connecting to SOCKS5 proxy $proxyHost:$proxyPort for $targetHost:$targetPort")
            
            // Check if socket is already connected (e.g., when reusing a socket)
            if (!socket.isConnected) {
                // Configure socket for better performance
                socket.soTimeout = 15_000
                socket.tcpNoDelay = true
                socket.keepAlive = true
                socket.receiveBufferSize = 65536
                socket.sendBufferSize = 65536
                
                Log.d(TAG, "🔌 Connecting socket to proxy...")
                socket.connect(InetSocketAddress(proxyHost, proxyPort), 15_000)
                
                if (!socket.isConnected) {
                    Log.e(TAG, "Failed to connect to proxy")
                    return false
                }
                Log.d(TAG, "✅ Socket connected to proxy")
            } else {
                Log.d(TAG, "✅ Socket already connected to proxy, reusing connection")
            }
            
            val input = socket.getInputStream()
            val output = socket.getOutputStream()
            
            // Step 1: Authentication method negotiation
            if (!username.isNullOrEmpty() && !password.isNullOrEmpty()) {
                // Request username/password auth (support both no-auth and user/pass)
                output.write(byteArrayOf(0x05, 0x02, 0x00, 0x02))
                Log.d(TAG, "Requesting auth methods: NO_AUTH(0x00) and USERNAME_PASSWORD(0x02)")
            } else {
                // Request no auth
                output.write(byteArrayOf(0x05, 0x01, 0x00))
                Log.d(TAG, "Requesting auth method: NO_AUTH(0x00)")
            }
            output.flush()
            
            // Read auth method response
            val authResponse = ByteArray(2)
            if (input.read(authResponse) != 2) {
                Log.e(TAG, "Failed to read auth method response")
                return false
            }
            
            if (authResponse[0] != 0x05.toByte()) {
                Log.e(TAG, "Invalid SOCKS version: ${authResponse[0]}")
                return false
            }
            
            // Step 2: Handle authentication
            when (authResponse[1].toInt() and 0xFF) {
                0x00 -> {
                    Log.d(TAG, "No authentication required")
                }
                0x02 -> {
                    if (username.isNullOrEmpty() || password.isNullOrEmpty()) {
                        Log.e(TAG, "Proxy requires auth but no credentials provided")
                        return false
                    }
                    
                    Log.d(TAG, "Performing username/password authentication")
                    
                    // Send auth request
                    val authRequest = mutableListOf<Byte>()
                    authRequest.add(0x01) // Auth version
                    authRequest.add(username.length.toByte())
                    authRequest.addAll(username.toByteArray().toList())
                    authRequest.add(password.length.toByte())
                    authRequest.addAll(password.toByteArray().toList())
                    
                    output.write(authRequest.toByteArray())
                    output.flush()
                    
                    // Read auth response
                    val authResult = ByteArray(2)
                    if (input.read(authResult) != 2) {
                        Log.e(TAG, "Failed to read auth response")
                        return false
                    }
                    
                    if (authResult[1] != 0x00.toByte()) {
                        Log.e(TAG, "Authentication failed: ${authResult[1]}")
                        return false
                    }
                    
                    Log.d(TAG, "Authentication successful")
                }
                0xFF -> {
                    Log.e(TAG, "No acceptable authentication methods")
                    return false
                }
                else -> {
                    Log.e(TAG, "Unknown auth method: ${authResponse[1]}")
                    return false
                }
            }
            
            // Step 3: Send CONNECT request
            val connectRequest = mutableListOf<Byte>()
            connectRequest.add(0x05) // SOCKS version
            connectRequest.add(0x01) // CONNECT command
            connectRequest.add(0x00) // Reserved
            
            // Address type and address
            if (targetHost.matches(Regex("\\d+\\.\\d+\\.\\d+\\.\\d+"))) {
                // IPv4
                connectRequest.add(0x01)
                targetHost.split(".").forEach {
                    connectRequest.add((it.toInt() and 0xFF).toByte())
                }
            } else {
                // Domain name
                connectRequest.add(0x03)
                connectRequest.add(targetHost.length.toByte())
                connectRequest.addAll(targetHost.toByteArray().toList())
            }
            
            // Port
            connectRequest.add((targetPort shr 8).toByte())
            connectRequest.add((targetPort and 0xFF).toByte())
            
            output.write(connectRequest.toByteArray())
            output.flush()
            
            // Read CONNECT response
            val connectResponse = ByteArray(4)
            if (input.read(connectResponse) != 4) {
                Log.e(TAG, "Failed to read CONNECT response")
                return false
            }
            
            if (connectResponse[0] != 0x05.toByte()) {
                Log.e(TAG, "Invalid SOCKS version in response: ${connectResponse[0]}")
                return false
            }
            
            if (connectResponse[1] != 0x00.toByte()) {
                val errorMsg = when (connectResponse[1].toInt() and 0xFF) {
                    0x01 -> "General SOCKS server failure"
                    0x02 -> "Connection not allowed by ruleset"
                    0x03 -> "Network unreachable"
                    0x04 -> "Host unreachable"
                    0x05 -> "Connection refused"
                    0x06 -> "TTL expired"
                    0x07 -> "Command not supported"
                    0x08 -> "Address type not supported"
                    else -> "Unknown error: ${connectResponse[1]}"
                }
                Log.e(TAG, "SOCKS5 CONNECT failed: $errorMsg")
                return false
            }
            
            // Skip bind address (read and discard)
            val addrType = connectResponse[3].toInt() and 0xFF
            when (addrType) {
                0x01 -> { // IPv4
                    val addr = ByteArray(4)
                    input.read(addr)
                }
                0x03 -> { // Domain
                    val len = input.read()
                    if (len > 0) {
                        val domain = ByteArray(len)
                        input.read(domain)
                    }
                }
                0x04 -> { // IPv6
                    val addr = ByteArray(16)
                    input.read(addr)
                }
            }
            // Read port (2 bytes)
            val port = ByteArray(2)
            input.read(port)
            
            // Reset timeout for data transfer
            socket.soTimeout = 0 // No timeout for established connections
            
            Log.d(TAG, "✅ SOCKS5 tunnel established to $targetHost:$targetPort")
            return true
            
        } catch (e: Exception) {
            Log.e(TAG, "SOCKS5 connection error: ${e.message}", e)
            return false
        }
    }
}

interface ProxyHandler {
    fun connect(targetHost: String, targetPort: Int, socket: Socket): Boolean
}
