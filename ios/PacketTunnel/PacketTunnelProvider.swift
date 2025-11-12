import NetworkExtension
import Network

class PacketTunnelProvider: NEPacketTunnelProvider {

    private var proxyConnection: NWConnection?
    private var proxyHandler: ProxyHandler?
    private var pendingPackets: [Data] = []

    // MARK: - Tunnel Lifecycle

    override func startTunnel(options: [String : NSObject]?, completionHandler: @escaping (Error?) -> Void) {
        NSLog("🚀 PacketTunnelProvider: Starting VPN tunnel")

        // Get configuration from provider configuration
        guard let providerConfiguration = self.protocolConfiguration as? NETunnelProviderProtocol,
              let config = providerConfiguration.providerConfiguration else {
            NSLog("❌ PacketTunnelProvider: No provider configuration found")
            completionHandler(NSError(domain: "PacketTunnel", code: -1, userInfo: [NSLocalizedDescriptionKey: "No configuration provided"]))
            return
        }

        // Extract proxy settings
        guard let host = config["host"] as? String,
              let port = config["port"] as? Int,
              let type = config["type"] as? String else {
            NSLog("❌ PacketTunnelProvider: Invalid proxy configuration")
            completionHandler(NSError(domain: "PacketTunnel", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid proxy configuration"]))
            return
        }

        let username = config["username"] as? String
        let password = config["password"] as? String
        let dns1 = config["dns1"] as? String ?? "1.1.1.1"
        let dns2 = config["dns2"] as? String ?? "8.8.8.8"

        NSLog("📡 PacketTunnelProvider: Proxy config - Host: \(host), Port: \(port), Type: \(type)")

        // Create proxy handler based on type
        if type.lowercased() == "socks5" {
            self.proxyHandler = SOCKS5ProxyHandler(host: host, port: port, username: username, password: password)
        } else if type.lowercased() == "http" {
            self.proxyHandler = HTTPProxyHandler(host: host, port: port, username: username, password: password)
        } else {
            NSLog("❌ PacketTunnelProvider: Unsupported proxy type: \(type)")
            completionHandler(NSError(domain: "PacketTunnel", code: -1, userInfo: [NSLocalizedDescriptionKey: "Unsupported proxy type"]))
            return
        }

        // Configure tunnel network settings
        let tunnelNetworkSettings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: host)

        // Configure IPv4 settings
        let ipv4Settings = NEIPv4Settings(addresses: ["10.0.0.2"], subnetMasks: ["255.255.255.0"])
        ipv4Settings.includedRoutes = [NEIPv4Route.default()]
        ipv4Settings.excludedRoutes = []
        tunnelNetworkSettings.ipv4Settings = ipv4Settings

        // Configure DNS settings
        let dnsSettings = NEDNSSettings(servers: [dns1, dns2])
        dnsSettings.matchDomains = [""]
        tunnelNetworkSettings.dnsSettings = dnsSettings

        // Configure MTU
        tunnelNetworkSettings.mtu = 1500

        // Apply tunnel settings
        setTunnelNetworkSettings(tunnelNetworkSettings) { error in
            if let error = error {
                NSLog("❌ PacketTunnelProvider: Failed to set tunnel network settings: \(error.localizedDescription)")
                completionHandler(error)
                return
            }

            NSLog("✅ PacketTunnelProvider: Tunnel network settings applied successfully")

            // Start reading packets
            self.startReadingPackets()

            completionHandler(nil)
        }
    }

    override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        NSLog("🛑 PacketTunnelProvider: Stopping VPN tunnel, reason: \(reason)")

        // Close proxy connection
        proxyConnection?.cancel()
        proxyConnection = nil
        proxyHandler = nil

        completionHandler()
    }

    override func handleAppMessage(_ messageData: Data, completionHandler: ((Data?) -> Void)?) {
        // Handle messages from the main app if needed
        NSLog("📨 PacketTunnelProvider: Received app message")
        completionHandler?(nil)
    }

    // MARK: - Packet Handling

    private func startReadingPackets() {
        NSLog("📦 PacketTunnelProvider: Starting to read packets")

        packetFlow.readPackets { [weak self] packets, protocols in
            guard let self = self else { return }

            for (index, packet) in packets.enumerated() {
                let protocolNumber = protocols[index]
                self.handlePacket(packet, protocolNumber: protocolNumber)
            }

            // Continue reading
            self.startReadingPackets()
        }
    }

    private func handlePacket(_ packet: Data, protocolNumber: NSNumber) {
        // Parse IP packet
        guard packet.count >= 20 else {
            NSLog("⚠️ PacketTunnelProvider: Packet too small: \(packet.count) bytes")
            return
        }

        let ipVersion = (packet[0] & 0xF0) >> 4

        if ipVersion == 4 {
            handleIPv4Packet(packet)
        } else if ipVersion == 6 {
            handleIPv6Packet(packet)
        } else {
            NSLog("⚠️ PacketTunnelProvider: Unknown IP version: \(ipVersion)")
        }
    }

    private func handleIPv4Packet(_ packet: Data) {
        // Extract IP header
        let headerLength = Int((packet[0] & 0x0F)) * 4
        guard packet.count >= headerLength else { return }

        let protocol = packet[9] // Protocol field

        // Extract source and destination IPs
        let srcIP = packet[12..<16]
        let dstIP = packet[16..<20]

        let srcIPString = srcIP.map { String($0) }.joined(separator: ".")
        let dstIPString = dstIP.map { String($0) }.joined(separator: ".")

        if protocol == 6 { // TCP
            handleTCPPacket(packet, headerLength: headerLength, srcIP: srcIPString, dstIP: dstIPString)
        } else if protocol == 17 { // UDP
            handleUDPPacket(packet, headerLength: headerLength, srcIP: srcIPString, dstIP: dstIPString)
        } else {
            NSLog("⚠️ PacketTunnelProvider: Unsupported protocol: \(protocol)")
        }
    }

    private func handleIPv6Packet(_ packet: Data) {
        // IPv6 handling - basic implementation
        NSLog("⚠️ PacketTunnelProvider: IPv6 packet received (not fully implemented)")
        // TODO: Implement full IPv6 support
    }

    private func handleTCPPacket(_ packet: Data, headerLength: Int, srcIP: String, dstIP: String) {
        guard packet.count >= headerLength + 20 else { return }

        let tcpHeader = packet[headerLength...]

        // Extract source and destination ports
        let srcPort = UInt16(tcpHeader[0]) << 8 | UInt16(tcpHeader[1])
        let dstPort = UInt16(tcpHeader[2]) << 8 | UInt16(tcpHeader[3])

        NSLog("🔵 PacketTunnelProvider: TCP packet - \(srcIP):\(srcPort) -> \(dstIP):\(dstPort)")

        // For a full implementation, you would:
        // 1. Maintain a connection table to track TCP connections
        // 2. Parse TCP flags (SYN, ACK, FIN, etc.)
        // 3. Establish proxy connection for new SYN packets
        // 4. Route data through proxy for established connections
        // 5. Handle connection teardown for FIN packets

        // This is a simplified version - full implementation would require a TCP state machine
        // and connection multiplexing similar to the Android implementation

        // For now, we'll log the packet
        // In production, integrate a library like go-tun2socks or implement full TCP state machine
    }

    private func handleUDPPacket(_ packet: Data, headerLength: Int, srcIP: String, dstIP: String) {
        guard packet.count >= headerLength + 8 else { return }

        let udpHeader = packet[headerLength...]

        // Extract source and destination ports
        let srcPort = UInt16(udpHeader[0]) << 8 | UInt16(udpHeader[1])
        let dstPort = UInt16(udpHeader[2]) << 8 | UInt16(udpHeader[3])

        NSLog("🟣 PacketTunnelProvider: UDP packet - \(srcIP):\(srcPort) -> \(dstIP):\(dstPort)")

        // For UDP:
        // 1. Create UDP proxy connection if needed
        // 2. Forward UDP packets through proxy
        // 3. Handle responses and send back to packet flow

        // This requires UDP association support in the proxy
        // SOCKS5 supports UDP association, HTTP proxies typically don't
    }

    // MARK: - Sleep/Wake Handling

    override func sleep(completionHandler: @escaping () -> Void) {
        NSLog("💤 PacketTunnelProvider: Going to sleep")
        completionHandler()
    }

    override func wake() {
        NSLog("☀️ PacketTunnelProvider: Waking up")
    }
}

// MARK: - Protocol for Proxy Handlers

protocol ProxyHandler {
    func connect(to destinationHost: String, port: UInt16, completion: @escaping (NWConnection?, Error?) -> Void)
}

extension SOCKS5ProxyHandler: ProxyHandler {}
extension HTTPProxyHandler: ProxyHandler {}
