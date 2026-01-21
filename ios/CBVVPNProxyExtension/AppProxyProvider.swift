import NetworkExtension

final class AppProxyProvider: NEAppProxyProvider {
  private let sessionQueue = DispatchQueue(label: "com.cbv.vpn.proxy.session")
  private var activeSessions: [ObjectIdentifier: TCPProxySession] = [:]
  private var proxyConfig: ProxyConfiguration?

  override func startProxy(options: [String : Any]? = nil, completionHandler: @escaping (Error?) -> Void) {
    let providerConfig = (protocolConfiguration as? NETunnelProviderProtocol)?.providerConfiguration
    proxyConfig = ProxyConfiguration(providerConfig: providerConfig)
    if proxyConfig == nil {
      completionHandler(NSError(domain: "CBVProxy", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing proxy configuration"]))
      return
    }
    completionHandler(nil)
  }

  override func stopProxy(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
    sessionQueue.async {
      for (_, session) in self.activeSessions {
        session.stop()
      }
      self.activeSessions.removeAll()
      completionHandler()
    }
  }

  override func handleNewFlow(_ flow: NEAppProxyFlow) -> Bool {
    guard let config = proxyConfig else {
      return false
    }

    guard let tcpFlow = flow as? NEAppProxyTCPFlow else {
      return false
    }

    let session = TCPProxySession(flow: tcpFlow, config: config, queue: sessionQueue) { [weak self] in
      self?.activeSessions.removeValue(forKey: ObjectIdentifier(tcpFlow))
    }

    activeSessions[ObjectIdentifier(tcpFlow)] = session
    session.start()
    return true
  }
}
