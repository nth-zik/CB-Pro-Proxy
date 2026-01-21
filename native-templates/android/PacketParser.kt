package com.cbv.vpn

import android.util.Log
import java.nio.ByteBuffer

/**
 * Parse IP packets and extract TCP/UDP information
 */
class PacketParser(private val data: ByteArray, private val length: Int, private val offset: Int = 0) {
    
    private val TAG = "PacketParser"
    
    var isValid = false
        private set
    
    // IP Header fields
    var ipVersion = 0
        private set
    var protocol = 0
        private set
    var sourceAddress = ""
        private set
    var destAddress = ""
        private set
    var ipHeaderLength = 0
        private set
    var totalLength = 0
        private set
    
    // TCP Header fields
    var sourcePort = 0
        private set
    var destPort = 0
        private set
    var tcpHeaderLength = 0
        private set
    var tcpFlags = 0
        private set
    var sequenceNumber = 0L
        private set
    var ackNumber = 0L
        private set
    
    // Payload
    var payloadOffset = 0
        private set
    var payloadLength = 0
        private set
    
    companion object {
        const val PROTOCOL_TCP = 6
        const val PROTOCOL_UDP = 17
        
        const val TCP_FLAG_FIN = 0x01
        const val TCP_FLAG_SYN = 0x02
        const val TCP_FLAG_RST = 0x04
        const val TCP_FLAG_PSH = 0x08
        const val TCP_FLAG_ACK = 0x10
        const val TCP_FLAG_URG = 0x20
    }
    
    init {
        parse()
    }
    
    private fun parse() {
        try {
            val actualLength = length - offset
            if (actualLength < 20) {
                Log.w(TAG, "❌ Packet too short: $actualLength bytes (offset=$offset)")
                return
            }
            
            val buffer = ByteBuffer.wrap(data, offset, actualLength)
            
            // Parse IP header
            val versionAndIHL = buffer.get().toInt() and 0xFF
            ipVersion = (versionAndIHL shr 4) and 0x0F
            ipHeaderLength = (versionAndIHL and 0x0F) * 4
            
            // Log first byte for debugging
            if (ipVersion != 4) {
                Log.d(TAG, "📊 First byte: 0x${String.format("%02X", versionAndIHL)} -> version=$ipVersion, IHL=${versionAndIHL and 0x0F}")
            }
            
            if (ipVersion != 4) {
                Log.w(TAG, "⚠️ Not IPv4: version=$ipVersion")
                return
            }
            
            if (ipHeaderLength < 20 || ipHeaderLength > actualLength) {
                Log.w(TAG, "❌ Invalid IP header length: $ipHeaderLength (actualLength=$actualLength)")
                return
            }
            
            // Skip Type of Service (byte 1)
            buffer.get()
            
            // Total length (bytes 2-3)
            totalLength = buffer.short.toInt() and 0xFFFF
            
            if (totalLength > actualLength) {
                Log.w(TAG, "⚠️ Total length ($totalLength) > packet length ($actualLength)")
                totalLength = actualLength
            }
            
            // Skip ID (bytes 4-5), Flags+Fragment (bytes 6-7), TTL (byte 8)
            buffer.position(buffer.position() + 5)
            
            // Protocol (byte 9)
            protocol = buffer.get().toInt() and 0xFF
            
            // Debug first 3 packets
            if (offset == 0 && data.size >= 20) {
                val byte9 = data[9].toInt() and 0xFF
                if (protocol != byte9) {
                    Log.e(TAG, "❌ PROTOCOL MISMATCH! Buffer read: $protocol, data[9]: $byte9")
                    Log.e(TAG, "   Buffer position after read: ${buffer.position()}")
                }
            }
            
            // Skip checksum
            buffer.position(buffer.position() + 2)
            
            // Source IP
            val srcBytes = ByteArray(4)
            buffer.get(srcBytes)
            sourceAddress = ipToString(srcBytes)
            
            // Dest IP
            val dstBytes = ByteArray(4)
            buffer.get(dstBytes)
            destAddress = ipToString(dstBytes)
            
            // Skip IP options if any
            buffer.position(ipHeaderLength)
            
            // Parse TCP/UDP header
            when (protocol) {
                PROTOCOL_TCP -> parseTCP(buffer)
                PROTOCOL_UDP -> parseUDP(buffer)
                else -> {
                    Log.d(TAG, "⚠️ Unsupported protocol: $protocol")
                    return
                }
            }
            
            isValid = true
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Parse error: ${e.message}")
            isValid = false
        }
    }
    
    private fun parseTCP(buffer: ByteBuffer) {
        if (buffer.remaining() < 20) {
            Log.w(TAG, "❌ TCP header too short")
            return
        }
        
        sourcePort = buffer.short.toInt() and 0xFFFF
        destPort = buffer.short.toInt() and 0xFFFF
        
        sequenceNumber = buffer.int.toLong() and 0xFFFFFFFFL
        ackNumber = buffer.int.toLong() and 0xFFFFFFFFL
        
        val dataOffsetAndFlags = buffer.short.toInt() and 0xFFFF
        tcpHeaderLength = ((dataOffsetAndFlags shr 12) and 0x0F) * 4
        tcpFlags = dataOffsetAndFlags and 0x3F
        
        // Skip window, checksum, urgent pointer
        buffer.position(buffer.position() + 6)
        
        // Skip TCP options if any
        val tcpOptionsLength = tcpHeaderLength - 20
        if (tcpOptionsLength > 0 && buffer.remaining() >= tcpOptionsLength) {
            buffer.position(buffer.position() + tcpOptionsLength)
        }
        
        payloadOffset = ipHeaderLength + tcpHeaderLength
        payloadLength = totalLength - payloadOffset
        
        if (payloadLength < 0) payloadLength = 0
    }
    
    private fun parseUDP(buffer: ByteBuffer) {
        if (buffer.remaining() < 8) {
            Log.w(TAG, "❌ UDP header too short")
            return
        }
        
        sourcePort = buffer.short.toInt() and 0xFFFF
        destPort = buffer.short.toInt() and 0xFFFF
        
        val udpLength = buffer.short.toInt() and 0xFFFF
        // Skip checksum
        buffer.position(buffer.position() + 2)
        
        payloadOffset = ipHeaderLength + 8
        payloadLength = udpLength - 8
        
        if (payloadLength < 0) payloadLength = 0
    }
    
    private fun ipToString(bytes: ByteArray): String {
        return "${bytes[0].toInt() and 0xFF}.${bytes[1].toInt() and 0xFF}." +
               "${bytes[2].toInt() and 0xFF}.${bytes[3].toInt() and 0xFF}"
    }
    
    fun isTCP() = protocol == PROTOCOL_TCP
    fun isUDP() = protocol == PROTOCOL_UDP
    
    fun hasTCPFlag(flag: Int) = (tcpFlags and flag) != 0
    
    fun isSYN() = hasTCPFlag(TCP_FLAG_SYN) && !hasTCPFlag(TCP_FLAG_ACK)
    fun isSYNACK() = hasTCPFlag(TCP_FLAG_SYN) and hasTCPFlag(TCP_FLAG_ACK)
    fun isACK() = hasTCPFlag(TCP_FLAG_ACK)
    fun isFIN() = hasTCPFlag(TCP_FLAG_FIN)
    fun isRST() = hasTCPFlag(TCP_FLAG_RST)
    fun isPSH() = hasTCPFlag(TCP_FLAG_PSH)
    
    fun getPayload(): ByteArray {
        if (payloadLength <= 0) return ByteArray(0)
        val actualOffset = offset + payloadOffset
        return data.copyOfRange(actualOffset, actualOffset + payloadLength)
    }
    
    fun getConnectionKey(): String {
        return "$sourceAddress:$sourcePort->$destAddress:$destPort"
    }
    
    fun logSummary() {
        val protoStr = when (protocol) {
            PROTOCOL_TCP -> "TCP"
            PROTOCOL_UDP -> "UDP"
            else -> "Proto$protocol"
        }
        
        val flagsStr = if (isTCP()) {
            buildString {
                if (hasTCPFlag(TCP_FLAG_SYN)) append("SYN ")
                if (hasTCPFlag(TCP_FLAG_ACK)) append("ACK ")
                if (hasTCPFlag(TCP_FLAG_FIN)) append("FIN ")
                if (hasTCPFlag(TCP_FLAG_RST)) append("RST ")
                if (hasTCPFlag(TCP_FLAG_PSH)) append("PSH ")
            }.trim()
        } else ""
        
        Log.d(TAG, "📦 $protoStr: $sourceAddress:$sourcePort → $destAddress:$destPort" +
                   if (flagsStr.isNotEmpty()) " [$flagsStr]" else "" +
                   " payload=$payloadLength bytes")
    }
}
