package com.cbv.vpn

import android.util.Log
import java.nio.ByteBuffer

/**
 * Build IP/TCP packets for responses
 */
class PacketBuilder {
    
    private val TAG = "PacketBuilder"
    
    companion object {
        private const val IP_VERSION = 4
        private const val IP_HEADER_LENGTH = 20
        private const val TCP_HEADER_LENGTH = 20
        
        fun buildTCPPacket(
            sourceIP: String,
            sourcePort: Int,
            destIP: String,
            destPort: Int,
            flags: Int,
            seqNumber: Long,
            ackNumber: Long,
            payload: ByteArray = ByteArray(0),
            windowSize: Int = 65535
        ): ByteArray {
            val totalLength = IP_HEADER_LENGTH + TCP_HEADER_LENGTH + payload.size
            val buffer = ByteBuffer.allocate(totalLength)
            
            // IP Header
            buffer.put(((IP_VERSION shl 4) or 5).toByte()) // Version + IHL
            buffer.put(0) // Type of Service
            buffer.putShort(totalLength.toShort()) // Total Length
            buffer.putShort(0) // Identification
            buffer.putShort(0x4000.toShort()) // Flags + Fragment Offset (Don't Fragment)
            buffer.put(64) // TTL
            buffer.put(PacketParser.PROTOCOL_TCP.toByte()) // Protocol
            buffer.putShort(0) // Checksum (will calculate later)
            
            // Source IP
            val srcIPBytes = ipStringToBytes(sourceIP)
            buffer.put(srcIPBytes)
            
            // Dest IP
            val dstIPBytes = ipStringToBytes(destIP)
            buffer.put(dstIPBytes)
            
            val ipChecksumPos = 10
            
            // TCP Header
            val tcpHeaderStart = buffer.position()
            buffer.putShort(sourcePort.toShort()) // Source Port
            buffer.putShort(destPort.toShort()) // Dest Port
            buffer.putInt(seqNumber.toInt()) // Sequence Number
            buffer.putInt(ackNumber.toInt()) // Acknowledgment Number
            buffer.putShort(((5 shl 12) or flags).toShort()) // Data Offset + Flags
            buffer.putShort(windowSize.toShort()) // Window Size
            buffer.putShort(0) // Checksum (will calculate later)
            buffer.putShort(0) // Urgent Pointer
            
            val tcpChecksumPos = tcpHeaderStart + 16
            
            // Payload
            if (payload.isNotEmpty()) {
                buffer.put(payload)
            }
            
            val packet = buffer.array()
            
            // Calculate IP checksum
            val ipChecksum = calculateChecksum(packet, 0, IP_HEADER_LENGTH)
            packet[ipChecksumPos] = (ipChecksum shr 8).toByte()
            packet[ipChecksumPos + 1] = ipChecksum.toByte()
            
            // Calculate TCP checksum
            val tcpChecksum = calculateTCPChecksum(
                srcIPBytes, dstIPBytes,
                packet, tcpHeaderStart, TCP_HEADER_LENGTH + payload.size
            )
            packet[tcpChecksumPos] = (tcpChecksum shr 8).toByte()
            packet[tcpChecksumPos + 1] = tcpChecksum.toByte()
            
            return packet
        }
        
        fun buildRSTPacket(parser: PacketParser): ByteArray {
            return buildTCPPacket(
                sourceIP = parser.destAddress,
                sourcePort = parser.destPort,
                destIP = parser.sourceAddress,
                destPort = parser.sourcePort,
                flags = PacketParser.TCP_FLAG_RST or PacketParser.TCP_FLAG_ACK,
                seqNumber = parser.ackNumber,
                ackNumber = parser.sequenceNumber + 1
            )
        }
        
        fun buildSYNACKPacket(parser: PacketParser, seqNumber: Long): ByteArray {
            return buildTCPPacket(
                sourceIP = parser.destAddress,
                sourcePort = parser.destPort,
                destIP = parser.sourceAddress,
                destPort = parser.sourcePort,
                flags = PacketParser.TCP_FLAG_SYN or PacketParser.TCP_FLAG_ACK,
                seqNumber = seqNumber,
                ackNumber = parser.sequenceNumber + 1
            )
        }
        
        fun buildACKPacket(
            parser: PacketParser,
            seqNumber: Long,
            ackNumber: Long,
            payload: ByteArray = ByteArray(0),
            windowSize: Int = 65535
        ): ByteArray {
            return buildTCPPacket(
                sourceIP = parser.destAddress,
                sourcePort = parser.destPort,
                destIP = parser.sourceAddress,
                destPort = parser.sourcePort,
                flags = PacketParser.TCP_FLAG_ACK,
                seqNumber = seqNumber,
                ackNumber = ackNumber,
                payload = payload,
                windowSize = windowSize
            )
        }
        
        fun buildFINACKPacket(parser: PacketParser, seqNumber: Long, ackNumber: Long): ByteArray {
            return buildTCPPacket(
                sourceIP = parser.destAddress,
                sourcePort = parser.destPort,
                destIP = parser.sourceAddress,
                destPort = parser.sourcePort,
                flags = PacketParser.TCP_FLAG_FIN or PacketParser.TCP_FLAG_ACK,
                seqNumber = seqNumber,
                ackNumber = ackNumber
            )
        }
        
        fun buildUDPPacket(
            sourceIP: String,
            sourcePort: Int,
            destIP: String,
            destPort: Int,
            payload: ByteArray
        ): ByteArray {
            val udpHeaderLength = 8
            val totalLength = IP_HEADER_LENGTH + udpHeaderLength + payload.size
            val buffer = ByteBuffer.allocate(totalLength)
            
            // IP Header
            buffer.put(((IP_VERSION shl 4) or 5).toByte()) // Version + IHL
            buffer.put(0) // Type of Service
            buffer.putShort(totalLength.toShort()) // Total Length
            buffer.putShort(0) // Identification
            buffer.putShort(0x4000.toShort()) // Flags + Fragment Offset (Don't Fragment)
            buffer.put(64) // TTL
            buffer.put(PacketParser.PROTOCOL_UDP.toByte()) // Protocol
            buffer.putShort(0) // Checksum (will calculate later)
            
            // Source IP
            val srcIPBytes = ipStringToBytes(sourceIP)
            buffer.put(srcIPBytes)
            
            // Dest IP
            val dstIPBytes = ipStringToBytes(destIP)
            buffer.put(dstIPBytes)
            
            val ipChecksumPos = 10
            
            // UDP Header
            val udpHeaderStart = buffer.position()
            buffer.putShort(sourcePort.toShort()) // Source Port
            buffer.putShort(destPort.toShort()) // Dest Port
            buffer.putShort((udpHeaderLength + payload.size).toShort()) // UDP Length
            buffer.putShort(0) // Checksum (will calculate later)
            
            val udpChecksumPos = udpHeaderStart + 6
            
            // Payload
            if (payload.isNotEmpty()) {
                buffer.put(payload)
            }
            
            val packet = buffer.array()
            
            // Calculate IP checksum
            val ipChecksum = calculateChecksum(packet, 0, IP_HEADER_LENGTH)
            packet[ipChecksumPos] = (ipChecksum shr 8).toByte()
            packet[ipChecksumPos + 1] = ipChecksum.toByte()
            
            // Calculate UDP checksum
            val udpChecksum = calculateUDPChecksum(
                srcIPBytes, dstIPBytes,
                packet, udpHeaderStart, udpHeaderLength + payload.size
            )
            packet[udpChecksumPos] = (udpChecksum shr 8).toByte()
            packet[udpChecksumPos + 1] = udpChecksum.toByte()
            
            return packet
        }
        
        private fun ipStringToBytes(ip: String): ByteArray {
            val parts = ip.split(".")
            return ByteArray(4) { i ->
                parts[i].toInt().toByte()
            }
        }
        
        private fun calculateChecksum(data: ByteArray, offset: Int, length: Int): Int {
            var sum = 0L
            var i = offset
            val end = offset + length
            
            while (i < end - 1) {
                sum += ((data[i].toInt() and 0xFF) shl 8) or (data[i + 1].toInt() and 0xFF)
                i += 2
            }
            
            if (i < end) {
                sum += (data[i].toInt() and 0xFF) shl 8
            }
            
            while (sum shr 16 != 0L) {
                sum = (sum and 0xFFFF) + (sum shr 16)
            }
            
            return (sum.inv() and 0xFFFF).toInt()
        }
        
        private fun calculateTCPChecksum(
            srcIP: ByteArray,
            dstIP: ByteArray,
            data: ByteArray,
            offset: Int,
            length: Int
        ): Int {
            var sum = 0L
            
            // Pseudo header
            for (i in 0..3) {
                sum += (srcIP[i].toInt() and 0xFF) shl if (i % 2 == 0) 8 else 0
                if (i % 2 == 1) sum = (sum and 0xFFFF) + (sum shr 16)
            }
            
            for (i in 0..3) {
                sum += (dstIP[i].toInt() and 0xFF) shl if (i % 2 == 0) 8 else 0
                if (i % 2 == 1) sum = (sum and 0xFFFF) + (sum shr 16)
            }
            
            sum += PacketParser.PROTOCOL_TCP
            sum += length
            
            // TCP segment
            var i = offset
            val end = offset + length
            
            while (i < end - 1) {
                sum += ((data[i].toInt() and 0xFF) shl 8) or (data[i + 1].toInt() and 0xFF)
                i += 2
            }
            
            if (i < end) {
                sum += (data[i].toInt() and 0xFF) shl 8
            }
            
            while (sum shr 16 != 0L) {
                sum = (sum and 0xFFFF) + (sum shr 16)
            }
            
            return (sum.inv() and 0xFFFF).toInt()
        }
        
        private fun calculateUDPChecksum(
            srcIP: ByteArray,
            dstIP: ByteArray,
            data: ByteArray,
            offset: Int,
            length: Int
        ): Int {
            var sum = 0L
            
            // Pseudo header
            for (i in 0..3) {
                sum += (srcIP[i].toInt() and 0xFF) shl if (i % 2 == 0) 8 else 0
                if (i % 2 == 1) sum = (sum and 0xFFFF) + (sum shr 16)
            }
            
            for (i in 0..3) {
                sum += (dstIP[i].toInt() and 0xFF) shl if (i % 2 == 0) 8 else 0
                if (i % 2 == 1) sum = (sum and 0xFFFF) + (sum shr 16)
            }
            
            sum += PacketParser.PROTOCOL_UDP
            sum += length
            
            // UDP segment
            var i = offset
            val end = offset + length
            
            while (i < end - 1) {
                sum += ((data[i].toInt() and 0xFF) shl 8) or (data[i + 1].toInt() and 0xFF)
                i += 2
            }
            
            if (i < end) {
                sum += (data[i].toInt() and 0xFF) shl 8
            }
            
            while (sum shr 16 != 0L) {
                sum = (sum and 0xFFFF) + (sum shr 16)
            }
            
            return (sum.inv() and 0xFFFF).toInt()
        }
    }
}
