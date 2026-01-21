import Foundation
import Network
import NetworkExtension
import Darwin

final class PacketTunnelProvider: NEPacketTunnelProvider {
  private let outputQueue = DispatchQueue(label: "com.cbv.vpn.tunnel.output")
  private var isStopping = false
  private var readLoopStarted = false
  private var writeLoopStarted = false

  override func startTunnel(options: [String: NSObject]?, completionHandler: @escaping (Error?) -> Void) {
    let providerConfig = (protocolConfiguration as? NETunnelProviderProtocol)?.providerConfiguration
    guard let config = ProxyConfiguration(providerConfig: providerConfig) else {
      completionHandler(NSError(domain: "CBVProxy", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing proxy configuration"]))
      return
    }

    NSLog("[CBVVPN] startTunnel proxyType=%@ host=%@ port=%d dns=%@", config.type.rawValue, config.host, config.port, config.dnsServers.joined(separator: ","))

    let settings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: config.host)

    let ipv4Settings = NEIPv4Settings(addresses: ["10.0.0.2"], subnetMasks: ["255.255.255.0"])
    ipv4Settings.includedRoutes = [NEIPv4Route.default()]
    let excludedRoutes = resolveProxyIPv4Routes(host: config.host)
    if !excludedRoutes.isEmpty {
      ipv4Settings.excludedRoutes = excludedRoutes
      NSLog("[CBVVPN] excludedRoutes=%@", excludedRoutes.map { "\($0.destinationAddress)/\($0.destinationSubnetMask)" }.joined(separator: ","))
    }
    settings.ipv4Settings = ipv4Settings
    settings.mtu = 1500

    let dnsServers = config.dnsServers.isEmpty ? ["1.1.1.1", "8.8.8.8"] : config.dnsServers
    let dnsSettings = NEDNSSettings(servers: dnsServers)
    dnsSettings.matchDomains = [""]
    settings.dnsSettings = dnsSettings

    setTunnelNetworkSettings(settings) { [weak self] error in
      guard let self else { return }
      if let error {
        NSLog("[CBVVPN] setTunnelNetworkSettings error=%@", error.localizedDescription)
        completionHandler(error)
        return
      }

      do {
        try Tun2SocksBridge.start(config: config)
      } catch {
        NSLog("[CBVVPN] Tun2Socks start error=%@", error.localizedDescription)
        completionHandler(error)
        return
      }

      NSLog("[CBVVPN] tunnel started")
      self.startPacketReadLoop()
      self.startPacketWriteLoop()
      completionHandler(nil)
    }
  }

  override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
    isStopping = true
    NSLog("[CBVVPN] stopTunnel reason=%d", reason.rawValue)
    Tun2SocksBridge.stop()
    completionHandler()
  }

  private func startPacketReadLoop() {
    guard !readLoopStarted else { return }
    readLoopStarted = true
    readPacketsFromFlow()
  }

  private func readPacketsFromFlow() {
    guard !isStopping else { return }
    packetFlow.readPackets { [weak self] packets, _ in
      guard let self else { return }
      for packet in packets {
        Tun2SocksBridge.input(packet: packet)
      }
      self.readPacketsFromFlow()
    }
  }

  private func startPacketWriteLoop() {
    guard !writeLoopStarted else { return }
    writeLoopStarted = true

    outputQueue.async { [weak self] in
      guard let self else { return }
      let maxPacketSize = 65535
      let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: maxPacketSize)
      defer { buffer.deallocate() }

      while !self.isStopping {
        let length = Tun2SocksBridge.readPacket(into: buffer, maxLength: maxPacketSize)
        if length <= 0 {
          usleep(20_000)
          continue
        }

        let data = Data(bytes: buffer, count: length)
        let proto = self.protocolNumber(for: data)
        self.packetFlow.writePackets([data], withProtocols: [proto])
      }
    }
  }

  private func protocolNumber(for data: Data) -> NSNumber {
    guard let firstByte = data.first else {
      return NSNumber(value: AF_INET)
    }
    let version = firstByte >> 4
    if version == 6 {
      return NSNumber(value: AF_INET6)
    }
    return NSNumber(value: AF_INET)
  }

  private func resolveProxyIPv4Routes(host: String) -> [NEIPv4Route] {
    if IPv4Address(host) != nil {
      return [NEIPv4Route(destinationAddress: host, subnetMask: "255.255.255.255")]
    }

    var hints = addrinfo(
      ai_flags: AI_DEFAULT,
      ai_family: AF_INET,
      ai_socktype: SOCK_STREAM,
      ai_protocol: 0,
      ai_addrlen: 0,
      ai_canonname: nil,
      ai_addr: nil,
      ai_next: nil
    )
    var infoPtr: UnsafeMutablePointer<addrinfo>?
    let status = getaddrinfo(host, nil, &hints, &infoPtr)
    guard status == 0, let firstInfo = infoPtr else {
      return []
    }

    defer { freeaddrinfo(firstInfo) }

    var routes: [NEIPv4Route] = []
    var seen = Set<String>()
    var pointer: UnsafeMutablePointer<addrinfo>? = firstInfo
    while let info = pointer {
      if info.pointee.ai_family == AF_INET,
         let addr = info.pointee.ai_addr?.withMemoryRebound(to: sockaddr_in.self, capacity: 1, { $0.pointee }) {
        var address = addr.sin_addr
        var buffer = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
        if inet_ntop(AF_INET, &address, &buffer, socklen_t(INET_ADDRSTRLEN)) != nil {
          let ip = String(cString: buffer)
          if seen.insert(ip).inserted {
            routes.append(NEIPv4Route(destinationAddress: ip, subnetMask: "255.255.255.255"))
          }
        }
      }
      pointer = info.pointee.ai_next
    }

    return routes
  }
}
