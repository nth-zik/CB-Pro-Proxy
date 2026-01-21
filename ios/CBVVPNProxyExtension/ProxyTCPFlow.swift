import Foundation
import Network
import NetworkExtension

final class TCPProxySession {
  private let flow: NEAppProxyTCPFlow
  private let config: ProxyConfiguration
  private let queue: DispatchQueue
  private let onClose: () -> Void

  private var connection: NWConnection?
  private var isClosed = false
  private var readBuffer = Data()

  private var destinationHost: String = ""
  private var destinationPort: UInt16 = 0

  init(flow: NEAppProxyTCPFlow, config: ProxyConfiguration, queue: DispatchQueue, onClose: @escaping () -> Void) {
    self.flow = flow
    self.config = config
    self.queue = queue
    self.onClose = onClose
  }

  func start() {
    guard resolveDestination() else {
      finishWithError("Unable to determine destination")
      return
    }

    openFlow { [weak self] error in
      if let error = error {
        self?.finishWithError(error.localizedDescription)
        return
      }
      self?.connectToProxy()
    }
  }

  func stop() {
    finishWithError(nil)
  }

  private func resolveDestination() -> Bool {
    if let hostEndpoint = flow.remoteEndpoint as? NWHostEndpoint {
      destinationHost = hostEndpoint.hostname
      destinationPort = UInt16(hostEndpoint.port) ?? 0
    } else if let hostname = flow.remoteHostname {
      destinationHost = hostname
    }

    return !destinationHost.isEmpty && destinationPort > 0
  }

  private func openFlow(completion: @escaping (Error?) -> Void) {
    if #available(iOS 18.0, *) {
      flow.open(withLocalFlowEndpoint: nil, completionHandler: completion)
    } else {
      flow.open(withLocalEndpoint: nil, completionHandler: completion)
    }
  }

  private func connectToProxy() {
    let host = NWEndpoint.Host(config.host)
    guard let port = NWEndpoint.Port(rawValue: config.port) else {
      finishWithError("Invalid proxy port")
      return
    }

    let connection = NWConnection(host: host, port: port, using: .tcp)
    self.connection = connection

    connection.stateUpdateHandler = { [weak self] state in
      switch state {
      case .ready:
        self?.performHandshake()
      case .failed(let error):
        self?.finishWithError(error.localizedDescription)
      case .cancelled:
        self?.finishWithError(nil)
      default:
        break
      }
    }

    connection.start(queue: queue)
  }

  private func performHandshake() {
    switch config.type {
    case .socks5:
      performSocks5Handshake()
    case .http:
      performHttpHandshake()
    }
  }

  private func performSocks5Handshake() {
    let hasAuth = !config.username.isEmpty || !config.password.isEmpty
    var methods: [UInt8] = [0x00]
    if hasAuth {
      methods.append(0x02)
    }

    let greeting = Data([0x05, UInt8(methods.count)] + methods)
    send(greeting) { [weak self] error in
      if let error = error {
        self?.finishWithError(error.localizedDescription)
        return
      }
      self?.readExact(2) { result in
        switch result {
        case .failure(let error):
          self?.finishWithError(error.localizedDescription)
        case .success(let data):
          guard data.count == 2, data[0] == 0x05 else {
            self?.finishWithError("Invalid SOCKS5 response")
            return
          }
          let method = data[1]
          if method == 0x02 {
            self?.performSocks5Auth()
          } else if method == 0x00 {
            self?.performSocks5Connect()
          } else {
            self?.finishWithError("Unsupported SOCKS5 auth method")
          }
        }
      }
    }
  }

  private func performSocks5Auth() {
    let usernameData = Data(config.username.utf8)
    let passwordData = Data(config.password.utf8)
    var payload = Data([0x01, UInt8(usernameData.count)])
    payload.append(usernameData)
    payload.append(UInt8(passwordData.count))
    payload.append(passwordData)

    send(payload) { [weak self] error in
      if let error = error {
        self?.finishWithError(error.localizedDescription)
        return
      }
      self?.readExact(2) { result in
        switch result {
        case .failure(let error):
          self?.finishWithError(error.localizedDescription)
        case .success(let data):
          guard data.count == 2, data[1] == 0x00 else {
            self?.finishWithError("SOCKS5 auth failed")
            return
          }
          self?.performSocks5Connect()
        }
      }
    }
  }

  private func performSocks5Connect() {
    let portBytes = withUnsafeBytes(of: destinationPort.bigEndian, Array.init)
    var addressType: UInt8 = 0x03
    var addressData = Data()

    if let ipv4 = IPv4Address(destinationHost) {
      addressType = 0x01
      addressData = Data(ipv4.rawValue)
    } else if let ipv6 = IPv6Address(destinationHost) {
      addressType = 0x04
      addressData = Data(ipv6.rawValue)
    } else {
      let hostData = Data(destinationHost.utf8)
      addressData = Data([UInt8(hostData.count)])
      addressData.append(hostData)
    }

    var request = Data([0x05, 0x01, 0x00, addressType])
    request.append(addressData)
    request.append(contentsOf: portBytes)

    send(request) { [weak self] error in
      if let error = error {
        self?.finishWithError(error.localizedDescription)
        return
      }
      self?.readExact(4) { result in
        switch result {
        case .failure(let error):
          self?.finishWithError(error.localizedDescription)
        case .success(let data):
          guard data.count == 4, data[1] == 0x00 else {
            self?.finishWithError("SOCKS5 connect failed")
            return
          }
          let addrType = data[3]
          self?.consumeSocks5BindAddress(addrType: addrType)
        }
      }
    }
  }

  private func consumeSocks5BindAddress(addrType: UInt8) {
    let addressLength: Int
    switch addrType {
    case 0x01:
      addressLength = 4
    case 0x04:
      addressLength = 16
    case 0x03:
      readExact(1) { [weak self] result in
        switch result {
        case .failure(let error):
          self?.finishWithError(error.localizedDescription)
        case .success(let data):
          let length = data.first.map { Int($0) } ?? 0
          self?.consumeSocks5BindAddressData(length: length)
        }
      }
      return
    default:
      finishWithError("Unknown SOCKS5 address type")
      return
    }

    consumeSocks5BindAddressData(length: addressLength)
  }

  private func consumeSocks5BindAddressData(length: Int) {
    readExact(length + 2) { [weak self] result in
      switch result {
      case .failure(let error):
        self?.finishWithError(error.localizedDescription)
      case .success:
        self?.startProxying()
      }
    }
  }

  private func performHttpHandshake() {
    let hostPort = "\(destinationHost):\(destinationPort)"
    var request = "CONNECT \(hostPort) HTTP/1.1\r\nHost: \(hostPort)\r\n"

    if !config.username.isEmpty || !config.password.isEmpty {
      let auth = "\(config.username):\(config.password)"
      let token = Data(auth.utf8).base64EncodedString()
      request += "Proxy-Authorization: Basic \(token)\r\n"
    }

    request += "\r\n"

    send(Data(request.utf8)) { [weak self] error in
      if let error = error {
        self?.finishWithError(error.localizedDescription)
        return
      }
      self?.readUntil(sequence: Data("\r\n\r\n".utf8)) { result in
        switch result {
        case .failure(let error):
          self?.finishWithError(error.localizedDescription)
        case .success(let data):
          guard let response = String(data: data, encoding: .utf8), response.contains(" 200 ") else {
            self?.finishWithError("HTTP CONNECT failed")
            return
          }
          self?.startProxying()
        }
      }
    }
  }

  private func startProxying() {
    pumpFlowToProxy()
    pumpProxyToFlow()
  }

  private func pumpFlowToProxy() {
    flow.readData { [weak self] data, error in
      guard let self else { return }
      if let error = error {
        self.finishWithError(error.localizedDescription)
        return
      }
      guard let data = data, !data.isEmpty else {
        self.finishWithError(nil)
        return
      }
      self.send(data) { sendError in
        if let sendError = sendError {
          self.finishWithError(sendError.localizedDescription)
          return
        }
        self.pumpFlowToProxy()
      }
    }
  }

  private func pumpProxyToFlow() {
    receiveData { [weak self] result in
      guard let self else { return }
      switch result {
      case .failure(let error):
        self.finishWithError(error.localizedDescription)
      case .success(let data):
        guard let data = data, !data.isEmpty else {
          self.finishWithError(nil)
          return
        }
        self.flow.write(data, withCompletionHandler: { writeError in
          if let writeError = writeError {
            self.finishWithError(writeError.localizedDescription)
            return
          }
          self.pumpProxyToFlow()
        })
      }
    }
  }

  private func send(_ data: Data, completion: @escaping (Error?) -> Void) {
    guard let connection = connection else {
      completion(NSError(domain: NEAppProxyErrorDomain, code: NEAppProxyFlowError.invalidArgument.rawValue))
      return
    }
    connection.send(content: data, completion: .contentProcessed { error in
      completion(error)
    })
  }

  private func receiveData(completion: @escaping (Result<Data?, Error>) -> Void) {
    guard let connection = connection else {
      completion(.failure(NSError(domain: NEAppProxyErrorDomain, code: NEAppProxyFlowError.invalidArgument.rawValue)))
      return
    }
    connection.receive(minimumIncompleteLength: 1, maximumLength: 4096) { data, _, isComplete, error in
      if let error = error {
        completion(.failure(error))
        return
      }
      if isComplete && data == nil {
        completion(.success(nil))
        return
      }
      completion(.success(data))
    }
  }

  private func readExact(_ length: Int, completion: @escaping (Result<Data, Error>) -> Void) {
    if readBuffer.count >= length {
      let chunk = readBuffer.prefix(length)
      readBuffer.removeFirst(length)
      completion(.success(Data(chunk)))
      return
    }

    receiveData { [weak self] result in
      guard let self else { return }
      switch result {
      case .failure(let error):
        completion(.failure(error))
      case .success(let data):
        guard let data = data, !data.isEmpty else {
          completion(.failure(NSError(domain: NEAppProxyErrorDomain, code: NEAppProxyFlowError.invalidArgument.rawValue)))
          return
        }
        self.readBuffer.append(data)
        self.readExact(length, completion: completion)
      }
    }
  }

  private func readUntil(sequence: Data, completion: @escaping (Result<Data, Error>) -> Void) {
    if let range = readBuffer.range(of: sequence) {
      let chunk = readBuffer.prefix(upTo: range.upperBound)
      readBuffer.removeFirst(range.upperBound)
      completion(.success(Data(chunk)))
      return
    }

    receiveData { [weak self] result in
      guard let self else { return }
      switch result {
      case .failure(let error):
        completion(.failure(error))
      case .success(let data):
        guard let data = data, !data.isEmpty else {
          completion(.failure(NSError(domain: NEAppProxyErrorDomain, code: NEAppProxyFlowError.invalidArgument.rawValue)))
          return
        }
        self.readBuffer.append(data)
        self.readUntil(sequence: sequence, completion: completion)
      }
    }
  }

  private func finishWithError(_ message: String?) {
    queue.async {
      if self.isClosed {
        return
      }
      self.isClosed = true

      if let message = message {
        let error = NSError(domain: NEAppProxyErrorDomain, code: NEAppProxyFlowError.invalidArgument.rawValue, userInfo: [NSLocalizedDescriptionKey: message])
        self.flow.closeReadWithError(error)
        self.flow.closeWriteWithError(error)
      } else {
        self.flow.closeReadWithError(nil)
        self.flow.closeWriteWithError(nil)
      }

      self.connection?.cancel()
      self.connection = nil
      self.onClose()
    }
  }
}
