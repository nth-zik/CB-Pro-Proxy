package com.cbv.vpn

import android.net.VpnService
import android.util.Log
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import kotlin.concurrent.thread

/**
 * Handle UDP packets (mainly for DNS)
 */
class UDPHandler(
    private val vpnService: VpnService,
    private val vpnOutput: FileOutputStream
) {
    private val TAG = "UDPHandler"
    
    fun handleDNSQuery(parser: PacketParser) {
        // Only handle DNS queries (port 53)
        if (parser.destPort != 53) {
            Log.d(TAG, "⚠️ Non-DNS UDP not supported: ${parser.getConnectionKey()}")
            return
        }
        
        thread(start = true, name = "udp-dns-${parser.sourcePort}") {
            try {
                Log.d(TAG, "🔍 DNS query to ${parser.destAddress}:${parser.destPort}")
                
                val payload = parser.getPayload()
                if (payload.isEmpty()) {
                    Log.w(TAG, "Empty DNS query")
                    return@thread
                }
                
                // Create UDP socket
                val socket = DatagramSocket()
                socket.soTimeout = 5000
                
                // Protect socket to bypass VPN
                if (!vpnService.protect(socket)) {
                    Log.e(TAG, "Failed to protect DNS socket")
                    socket.close()
                    return@thread
                }
                
                // Send DNS query
                val destAddress = InetAddress.getByName(parser.destAddress)
                val sendPacket = DatagramPacket(payload, payload.size, destAddress, parser.destPort)
                socket.send(sendPacket)
                
                Log.d(TAG, "📤 Sent DNS query (${payload.size} bytes)")
                
                // Receive DNS response
                val receiveBuffer = ByteArray(512) // DNS response max size
                val receivePacket = DatagramPacket(receiveBuffer, receiveBuffer.size)
                
                try {
                    socket.receive(receivePacket)
                    val responseData = receiveBuffer.copyOf(receivePacket.length)
                    
                    Log.d(TAG, "📬 Received DNS response (${responseData.size} bytes)")
                    
                    // Build UDP response packet
                    val responsePacket = PacketBuilder.buildUDPPacket(
                        sourceIP = parser.destAddress,
                        sourcePort = parser.destPort,
                        destIP = parser.sourceAddress,
                        destPort = parser.sourcePort,
                        payload = responseData
                    )
                    
                    // Write to VPN
                    synchronized(vpnOutput) {
                        vpnOutput.write(responsePacket)
                    }
                    
                    Log.d(TAG, "✅ DNS response sent to app")
                    
                } catch (e: java.net.SocketTimeoutException) {
                    Log.w(TAG, "DNS query timeout")
                } finally {
                    socket.close()
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error handling DNS query: ${e.message}")
            }
        }
    }
}
