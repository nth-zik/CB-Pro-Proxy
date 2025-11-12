package com.cbv.vpn

import android.net.VpnService
import android.util.Log
import java.io.FileOutputStream
import java.util.concurrent.ConcurrentHashMap

/**
 * Manage all active TCP connections
 */
class ConnectionManager(
    private val vpnService: VpnService,
    private val vpnOutput: FileOutputStream,
    private val proxyHandler: ProxyHandler
) {
    
    private val TAG = "ConnectionManager"
    private val connections = ConcurrentHashMap<String, TCPConnection>()
    
    fun handlePacket(parser: PacketParser) {
        val key = parser.getConnectionKey()
        
        var connection = connections[key]
        
        if (connection == null && parser.isSYN()) {
            // New connection
            Log.d(TAG, "🆕 New connection: $key")
            connection = TCPConnection(parser, vpnService, vpnOutput, proxyHandler)
            connections[key] = connection
        }
        
        if (connection != null) {
            connection.handlePacket(parser)
            
            // Clean up closed connections
            if (parser.isFIN() || parser.isRST()) {
                connections.remove(key)
                Log.d(TAG, "🗑️ Removed connection: $key (total: ${connections.size})")
            }
        } else {
            Log.w(TAG, "⚠️ No connection found for: $key")
        }
    }
    
    fun closeAll() {
        Log.d(TAG, "🛑 Closing all connections (${connections.size})")
        connections.values.forEach { it.close() }
        connections.clear()
    }
    
    fun getActiveCount() = connections.size
}
