package com.cbv.vpn

import android.util.Base64
import android.util.Log
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.InetSocketAddress
import java.net.Socket

/**
 * Handle HTTP CONNECT proxy tunneling
 */
class HTTPProxyHandler(
    val proxyHost: String,
    val proxyPort: Int,
    private val username: String?,
    private val password: String?
) : ProxyHandler {
    
    private val TAG = "HTTPProxyHandler"
    
    /**
     * Connect to HTTP proxy and establish CONNECT tunnel
     */
    override fun connect(targetHost: String, targetPort: Int, socket: Socket): Boolean {
        try {
            Log.d(TAG, "Connecting to HTTP proxy $proxyHost:$proxyPort for $targetHost:$targetPort")

            // Configure socket for better performance
            socket.soTimeout = 30_000
            socket.tcpNoDelay = true
            socket.keepAlive = true
            socket.receiveBufferSize = 65536
            socket.sendBufferSize = 65536
            
            // Connect to proxy
            socket.connect(InetSocketAddress(proxyHost, proxyPort), 15_000)
            
            if (!socket.isConnected) {
                Log.e(TAG, "❌ Failed to connect to proxy (socket not connected after connect call)")
                return false
            }
            
            // Send CONNECT request
            val connectRequest = buildCONNECTRequest(targetHost, targetPort)
            Log.d(TAG, "Sending CONNECT request:\n${connectRequest.trim()}")
            
            // Write directly to output stream for better control
            val output = socket.getOutputStream()
            output.write(connectRequest.toByteArray(Charsets.UTF_8))
            output.flush()
            
            // Read response
            val input = socket.getInputStream()
            val reader = BufferedReader(InputStreamReader(input, Charsets.UTF_8))
            
            val statusLine = try {
                reader.readLine()
            } catch (timeout: java.net.SocketTimeoutException) {
                Log.e(TAG, "Timed out waiting for proxy response")
                return false
            }
            
            if (statusLine == null) {
                Log.e(TAG, "No response from proxy (status line null)")
                return false
            }
            
            Log.d(TAG, "Proxy response: $statusLine")
            
            // Read headers with timeout awareness
            var line: String?
            var headerCount = 0
            try {
                while (reader.readLine().also { line = it } != null) {
                    headerCount++
                    if (line!!.isEmpty()) break
                    if (headerCount > 50) { // Prevent infinite loop
                        Log.w(TAG, "Too many headers, stopping read")
                        break
                    }
                }
            } catch (timeout: java.net.SocketTimeoutException) {
                Log.w(TAG, "Timed out while reading proxy headers")
            }
            
            // Check status code - safely parse
            val parts = statusLine.split(" ")
            if (parts.size < 2) {
                Log.e(TAG, "Invalid status line: $statusLine")
                return false
            }
            val statusCode = parts[1].toIntOrNull() ?: 0
            
            val success = when (statusCode) {
                200 -> {
                    Log.d(TAG, "✅ HTTP proxy tunnel established")
                    true
                }
                407 -> {
                    Log.e(TAG, "❌ Proxy authentication required (407)")
                    false
                }
                else -> {
                    Log.e(TAG, "❌ Proxy returned status code: $statusCode ($statusLine)")
                    false
                }
            }
            
            if (success) {
                // Reset timeout for data transfer
                socket.soTimeout = 0 // No timeout for established connections
            }
            
            return success
            
        } catch (e: java.net.SocketTimeoutException) {
            Log.e(TAG, "HTTP proxy connection timeout: ${e.message}")
            return false
        } catch (e: java.io.IOException) {
            Log.e(TAG, "HTTP proxy I/O error: ${e.message}")
            return false
        } catch (e: Exception) {
            Log.e(TAG, "Error connecting to HTTP proxy: ${e.message}", e)
            return false
        }
    }
    
    private fun buildCONNECTRequest(targetHost: String, targetPort: Int): String {
        val request = StringBuilder()
        request.append("CONNECT $targetHost:$targetPort HTTP/1.1\r\n")
        request.append("Host: $targetHost:$targetPort\r\n")
        
        // Add authentication if provided
        if (!username.isNullOrEmpty() && !password.isNullOrEmpty()) {
            val credentials = "$username:$password"
            // Use Android's Base64 (available on all API levels) instead of java.util.Base64 (API 26+)
            val encoded = Base64.encodeToString(credentials.toByteArray(), Base64.NO_WRAP)
            request.append("Proxy-Authorization: Basic $encoded\r\n")
            Log.d(TAG, "Added basic auth for user: $username")
        }
        
        request.append("Proxy-Connection: Keep-Alive\r\n")
        request.append("\r\n")
        
        return request.toString()
    }
}
