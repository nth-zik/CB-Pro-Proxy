import Foundation

enum ProxyType: String {
  case socks5
  case http
}

struct ProxyConfiguration {
  let type: ProxyType
  let host: String
  let port: UInt16
  let username: String
  let password: String
  let dnsServers: [String]

  init?(providerConfig: [String: Any]?) {
    guard
      let providerConfig,
      let typeString = providerConfig["proxyType"] as? String,
      let type = ProxyType(rawValue: typeString.lowercased()),
      let host = providerConfig["host"] as? String,
      let portValue = providerConfig["port"]
    else {
      return nil
    }

    let port: UInt16
    if let portNumber = portValue as? NSNumber {
      port = UInt16(truncating: portNumber)
    } else if let portString = portValue as? String, let parsed = UInt16(portString) {
      port = parsed
    } else {
      return nil
    }

    guard port > 0 else {
      return nil
    }

    self.type = type
    self.host = host
    self.port = port
    self.username = providerConfig["username"] as? String ?? ""
    self.password = providerConfig["password"] as? String ?? ""
    let dns1 = providerConfig["dns1"] as? String
    let dns2 = providerConfig["dns2"] as? String
    self.dnsServers = [dns1, dns2].compactMap { $0 }.filter { !$0.isEmpty }
  }
}
