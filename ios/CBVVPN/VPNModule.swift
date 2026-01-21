import Foundation
import UIKit
import React
import NetworkExtension
import Network

@objc(VPNModule)
class VPNModule: RCTEventEmitter {
  private var hasListeners = false
  private let providerBundleId = "com.cbv.vpn.ProxyExtension"
  private let launchUrlKey = "cbvproxy.launchUrl"
  private var cachedStatusState = "disconnected"
  private var cachedIsConnected = false
  private var autoConnectEnabled = false
  private var powerProfile = "balanced"
  private var statusObserver: NSObjectProtocol?
  private let managerQueue = DispatchQueue(label: "com.cbv.vpn.manager")
  private var cachedManager: NETunnelProviderManager?
  private var isLoadingManager = false
  private var pendingManagerCallbacks: [(Result<NETunnelProviderManager, Error>) -> Void] = []

  override init() {
    super.init()
    statusObserver = NotificationCenter.default.addObserver(
      forName: .NEVPNStatusDidChange,
      object: nil,
      queue: nil
    ) { [weak self] _ in
      self?.refreshStatus()
    }
  }

  deinit {
    if let statusObserver {
      NotificationCenter.default.removeObserver(statusObserver)
    }
  }

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return [
      "statusChanged",
      "error",
      "profilesUpdated",
      "vpnPermissionRequired",
      "activeProfileChanged",
      "notificationPermissionRequired",
    ]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  @objc(getLaunchUrl:reject:)
  func getLaunchUrl(
    _ resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    let url = UserDefaults.standard.string(forKey: launchUrlKey)
    if url != nil {
      UserDefaults.standard.removeObject(forKey: launchUrlKey)
    }
    resolve(url ?? NSNull())
  }

  private func statusPayload() -> [String: Any] {
    return [
      "state": cachedStatusState,
      "isConnected": cachedIsConnected,
      "durationMillis": 0,
      "bytesUp": 0,
      "bytesDown": 0,
      "publicIp": NSNull(),
    ]
  }

  private func emitStatusChanged() {
    if hasListeners {
      sendEvent(withName: "statusChanged", body: statusPayload())
    }
  }

  private func emitError(_ message: String) {
    if hasListeners {
      sendEvent(withName: "error", body: ["message": message])
    }
  }

  private func setErrorState(_ message: String) {
    cachedStatusState = "error"
    cachedIsConnected = false
    emitError(message)
    emitStatusChanged()
  }

  private func reportLastDisconnectError(_ manager: NETunnelProviderManager) {
    if #available(iOS 16.0, *) {
      manager.connection.fetchLastDisconnectError { [weak self] error in
        guard let self, let error else { return }
        let message = self.formatError(error as NSError)
        self.setErrorState(message)
      }
    }
  }

  private func pollConnectionStatus(_ manager: NETunnelProviderManager, attempts: Int) {
    guard attempts > 0 else { return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
      guard let self else { return }
      self.updateCachedStatus(manager.connection.status)
      self.emitStatusChanged()
      if self.cachedStatusState == "connecting" {
        self.pollConnectionStatus(manager, attempts: attempts - 1)
      }
    }
  }

  private func waitForReady(_ connection: NWConnection, timeout: TimeInterval) -> Error? {
    let semaphore = DispatchSemaphore(value: 0)
    var resultError: Error?
    connection.stateUpdateHandler = { state in
      switch state {
      case .ready:
        semaphore.signal()
      case .failed(let error):
        resultError = error
        semaphore.signal()
      default:
        break
      }
    }
    connection.start(queue: DispatchQueue.global(qos: .utility))
    if semaphore.wait(timeout: .now() + timeout) == .timedOut {
      return NSError(domain: "CBVProxy", code: 2, userInfo: [NSLocalizedDescriptionKey: "Connection timed out"])
    }
    return resultError
  }

  private func sendData(_ connection: NWConnection, data: Data, timeout: TimeInterval) -> Error? {
    let semaphore = DispatchSemaphore(value: 0)
    var resultError: Error?
    connection.send(content: data, completion: .contentProcessed { error in
      resultError = error
      semaphore.signal()
    })
    if semaphore.wait(timeout: .now() + timeout) == .timedOut {
      return NSError(domain: "CBVProxy", code: 3, userInfo: [NSLocalizedDescriptionKey: "Send timed out"])
    }
    return resultError
  }

  private func receiveData(_ connection: NWConnection, maxLength: Int, timeout: TimeInterval) -> Result<Data, Error> {
    let semaphore = DispatchSemaphore(value: 0)
    var resultData = Data()
    var resultError: Error?
    connection.receive(minimumIncompleteLength: 1, maximumLength: maxLength) { data, _, _, error in
      if let data {
        resultData = data
      }
      resultError = error
      semaphore.signal()
    }
    if semaphore.wait(timeout: .now() + timeout) == .timedOut {
      return .failure(NSError(domain: "CBVProxy", code: 4, userInfo: [NSLocalizedDescriptionKey: "Receive timed out"]))
    }
    if let error = resultError {
      return .failure(error)
    }
    return .success(resultData)
  }

  private func receiveExact(_ connection: NWConnection, length: Int, timeout: TimeInterval) -> Result<Data, Error> {
    var buffer = Data()
    while buffer.count < length {
      let remaining = length - buffer.count
      switch receiveData(connection, maxLength: max(remaining, 1), timeout: timeout) {
      case .success(let chunk):
        if chunk.isEmpty {
          return .failure(NSError(domain: "CBVProxy", code: 5, userInfo: [NSLocalizedDescriptionKey: "Connection closed"]))
        }
        buffer.append(chunk)
      case .failure(let error):
        return .failure(error)
      }
    }
    return .success(buffer)
  }

  private func extractIp(_ text: String) -> String? {
    let pattern = "\\b\\d{1,3}(?:\\.\\d{1,3}){3}\\b"
    guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
      return nil
    }
    let range = NSRange(text.startIndex..<text.endIndex, in: text)
    if let match = regex.firstMatch(in: text, options: [], range: range),
       let ipRange = Range(match.range, in: text) {
      return String(text[ipRange])
    }
    return nil
  }

  private func checkHttpProxy(
    host: String,
    port: UInt16,
    username: String,
    password: String,
    timeout: TimeInterval
  ) throws -> (Bool, String?) {
    let connection = NWConnection(
      host: NWEndpoint.Host(host),
      port: NWEndpoint.Port(rawValue: port)!,
      using: .tcp
    )
    defer { connection.cancel() }

    if let error = waitForReady(connection, timeout: timeout) {
      throw error
    }

    var request = "GET http://ip-api.com/json HTTP/1.1\r\n"
    request += "Host: ip-api.com\r\n"
    request += "User-Agent: ProxyHealthCheck/1.0\r\n"
    request += "Connection: close\r\n"
    if !username.isEmpty || !password.isEmpty {
      let token = Data("\(username):\(password)".utf8).base64EncodedString()
      request += "Proxy-Authorization: Basic \(token)\r\n"
    }
    request += "\r\n"

    if let error = sendData(connection, data: Data(request.utf8), timeout: timeout) {
      throw error
    }

    var response = Data()
    let maxReads = 4
    for _ in 0..<maxReads {
      let result = receiveData(connection, maxLength: 2048, timeout: timeout)
      switch result {
      case .success(let chunk):
        if chunk.isEmpty {
          break
        }
        response.append(chunk)
        if response.count > 4096 {
          break
        }
      case .failure:
        break
      }
    }

    let responseText = String(data: response, encoding: .utf8) ?? ""
    let ok = responseText.contains("200 OK") || responseText.contains("HTTP/1.1 200") || responseText.contains("HTTP/1.0 200")
    let ip = extractIp(responseText)
    return (ok, ip)
  }

  private func checkSocks5Proxy(
    host: String,
    port: UInt16,
    username: String,
    password: String,
    timeout: TimeInterval
  ) throws -> (Bool, String?) {
    let connection = NWConnection(
      host: NWEndpoint.Host(host),
      port: NWEndpoint.Port(rawValue: port)!,
      using: .tcp
    )
    defer { connection.cancel() }

    if let error = waitForReady(connection, timeout: timeout) {
      throw error
    }

    let hasAuth = !username.isEmpty || !password.isEmpty
    let greet: [UInt8] = hasAuth ? [0x05, 0x02, 0x00, 0x02] : [0x05, 0x01, 0x00]
    if let error = sendData(connection, data: Data(greet), timeout: timeout) {
      throw error
    }

    let methodData = try receiveExact(connection, length: 2, timeout: timeout).get()
    let methodBytes = [UInt8](methodData)
    if methodBytes[0] != 0x05 {
      throw NSError(domain: "CBVProxy", code: 6, userInfo: [NSLocalizedDescriptionKey: "Invalid SOCKS version"])
    }

    if methodBytes[1] == 0x02 {
      let userBytes = [UInt8](username.utf8)
      let passBytes = [UInt8](password.utf8)
      var auth = [UInt8]()
      auth.append(0x01)
      auth.append(UInt8(min(userBytes.count, 255)))
      auth.append(contentsOf: userBytes.prefix(255))
      auth.append(UInt8(min(passBytes.count, 255)))
      auth.append(contentsOf: passBytes.prefix(255))
      if let error = sendData(connection, data: Data(auth), timeout: timeout) {
        throw error
      }
      let authResp = try receiveExact(connection, length: 2, timeout: timeout).get()
      let authBytes = [UInt8](authResp)
      if authBytes[1] != 0x00 {
        throw NSError(domain: "CBVProxy", code: 7, userInfo: [NSLocalizedDescriptionKey: "SOCKS authentication failed"])
      }
    } else if methodBytes[1] != 0x00 {
      throw NSError(domain: "CBVProxy", code: 8, userInfo: [NSLocalizedDescriptionKey: "SOCKS authentication unsupported"])
    }

    let targetHost = "ip-api.com"
    let targetPort: UInt16 = 80
    var connect = [UInt8]()
    connect.append(contentsOf: [0x05, 0x01, 0x00, 0x03, UInt8(targetHost.utf8.count)])
    connect.append(contentsOf: targetHost.utf8)
    connect.append(UInt8(targetPort >> 8))
    connect.append(UInt8(targetPort & 0xFF))
    if let error = sendData(connection, data: Data(connect), timeout: timeout) {
      throw error
    }

    let header = try receiveExact(connection, length: 4, timeout: timeout).get()
    let headerBytes = [UInt8](header)
    if headerBytes[1] != 0x00 {
      throw NSError(domain: "CBVProxy", code: 9, userInfo: [NSLocalizedDescriptionKey: "SOCKS connect failed"])
    }
    let addrType = headerBytes[3]
    var skipLength = 0
    if addrType == 0x01 {
      skipLength = 4
    } else if addrType == 0x03 {
      let lenData = try receiveExact(connection, length: 1, timeout: timeout).get()
      skipLength = Int(lenData[0])
    } else if addrType == 0x04 {
      skipLength = 16
    }
    if skipLength > 0 {
      _ = try receiveExact(connection, length: skipLength, timeout: timeout).get()
    }
    _ = try receiveExact(connection, length: 2, timeout: timeout).get()

    let request = "GET /json HTTP/1.1\r\nHost: ip-api.com\r\nUser-Agent: ProxyHealthCheck/1.0\r\nConnection: close\r\n\r\n"
    if let error = sendData(connection, data: Data(request.utf8), timeout: timeout) {
      throw error
    }

    var response = Data()
    let maxReads = 4
    for _ in 0..<maxReads {
      let result = receiveData(connection, maxLength: 2048, timeout: timeout)
      switch result {
      case .success(let chunk):
        if chunk.isEmpty {
          break
        }
        response.append(chunk)
        if response.count > 4096 {
          break
        }
      case .failure:
        break
      }
    }

    let responseText = String(data: response, encoding: .utf8) ?? ""
    let ok = responseText.contains("200 OK") || responseText.contains("HTTP/1.1 200") || responseText.contains("HTTP/1.0 200")
    let ip = extractIp(responseText)
    return (ok, ip)
  }

  private func startTunnel(
    _ manager: NETunnelProviderManager,
    retryOnStale: Bool,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      do {
        try manager.connection.startVPNTunnel()
        self.updateCachedStatus(manager.connection.status)
        self.emitStatusChanged()
        self.pollConnectionStatus(manager, attempts: 10)
        resolve(NSNull())
      } catch {
        let nsError = error as NSError
        if nsError.domain == NEVPNErrorDomain,
           let code = NEVPNError.Code(rawValue: nsError.code),
           code == .configurationStale,
           retryOnStale {
          manager.loadFromPreferences { [weak self] loadError in
            guard let self else { return }
            if let loadError {
              let message = self.formatError(loadError as NSError)
              self.setErrorState(message)
              reject("VPN_LOAD_ERROR", message, loadError)
              return
            }
            self.startTunnel(
              manager,
              retryOnStale: false,
              resolve: resolve,
              reject: reject
            )
          }
          return
        }
        let message = self.formatError(nsError)
        self.setErrorState(message)
        reject("VPN_START_ERROR", message, nsError)
      }
    }
  }

  private func formatError(_ error: NSError) -> String {
    if error.domain == NEVPNErrorDomain,
       let code = NEVPNError.Code(rawValue: error.code) {
      switch code {
      case .configurationInvalid:
        return "VPN configuration is invalid. Check Network Extension entitlements."
      case .configurationDisabled:
        return "VPN configuration is disabled."
      case .connectionFailed:
        return "VPN connection failed."
      case .configurationStale:
        return "VPN configuration is stale. Please retry."
      case .configurationReadWriteFailed:
        return "VPN configuration could not be saved. Check entitlements and provisioning."
      case .configurationUnknown:
        return "Unknown VPN configuration error."
      @unknown default:
        break
      }
    }

    if #available(iOS 16.0, *) {
      if error.domain == NEVPNConnectionErrorDomain,
         let code = NEVPNConnectionError(rawValue: error.code) {
        switch code {
        case .configurationFailed:
          return "VPN configuration failed to load."
        case .pluginDisabled:
          return "VPN extension is disabled or not installed."
        case .pluginFailed:
          return "VPN extension failed to start."
        case .authenticationFailed:
          return "Proxy authentication failed."
        case .serverNotResponding:
          return "Proxy server is not responding."
        case .serverAddressResolutionFailed:
          return "Proxy server address could not be resolved."
        case .noNetworkAvailable:
          return "No network available."
        default:
          return error.localizedDescription
        }
      }
    }

    return error.localizedDescription
  }

  private struct ProxyProfile {
    let host: String
    let port: Int
    let type: String
    let username: String
    let password: String
    let dns1: String?
    let dns2: String?
  }

  private func loadManager(completion: @escaping (Result<NETunnelProviderManager, Error>) -> Void) {
    managerQueue.async { [weak self] in
      guard let self else { return }
      if let cachedManager = self.cachedManager {
        DispatchQueue.main.async {
          completion(.success(cachedManager))
        }
        return
      }

      self.pendingManagerCallbacks.append(completion)
      if self.isLoadingManager {
        return
      }

      self.isLoadingManager = true
      NETunnelProviderManager.loadAllFromPreferences { [weak self] managers, error in
        guard let self else { return }
        self.managerQueue.async {
          self.isLoadingManager = false
          let callbacks = self.pendingManagerCallbacks
          self.pendingManagerCallbacks = []

          if let error {
            DispatchQueue.main.async {
              callbacks.forEach { $0(.failure(error)) }
            }
            return
          }

          let availableManagers = managers ?? []
          if !availableManagers.isEmpty {
            let matching = availableManagers.first { manager in
              let protocolConfig = manager.protocolConfiguration as? NETunnelProviderProtocol
              return protocolConfig?.providerBundleIdentifier == self.providerBundleId
            }
            let selected = matching ?? availableManagers.first
            for manager in availableManagers where manager !== selected {
              manager.removeFromPreferences { _ in }
            }
            if let selected {
              self.cachedManager = selected
              DispatchQueue.main.async {
                callbacks.forEach { $0(.success(selected)) }
              }
              return
            }
          }

          let created = NETunnelProviderManager()
          self.cachedManager = created
          DispatchQueue.main.async {
            callbacks.forEach { $0(.success(created)) }
          }
        }
      }
    }
  }

  private func configureManager(_ manager: NETunnelProviderManager, profile: ProxyProfile?, completion: @escaping (Error?) -> Void) {
    let protocolConfig = NETunnelProviderProtocol()
    protocolConfig.providerBundleIdentifier = providerBundleId
    protocolConfig.serverAddress = profile?.host ?? "Proxy"

    if let profile {
      var providerConfiguration: [String: Any] = [
        "proxyType": profile.type.lowercased(),
        "host": profile.host,
        "port": profile.port,
        "username": profile.username,
        "password": profile.password,
      ]
      if let dns1 = profile.dns1 {
        providerConfiguration["dns1"] = dns1
      }
      if let dns2 = profile.dns2 {
        providerConfiguration["dns2"] = dns2
      }
      protocolConfig.providerConfiguration = providerConfiguration
    }

    manager.localizedDescription = "CBV Proxy"
    manager.protocolConfiguration = protocolConfig
    manager.isEnabled = true
    DispatchQueue.main.async {
      manager.saveToPreferences { error in
        completion(error)
      }
    }
  }

  private func updateCachedStatus(_ status: NEVPNStatus) {
    switch status {
    case .connected:
      cachedStatusState = "connected"
      cachedIsConnected = true
    case .connecting, .reasserting:
      cachedStatusState = "connecting"
      cachedIsConnected = false
    default:
      cachedStatusState = "disconnected"
      cachedIsConnected = false
    }
  }

  @objc func getProfiles(
    _ resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    resolve([])
  }

  @objc func getActiveProfileId(
    _ resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    resolve(NSNull())
  }

  @objc func saveProfile(
    _ name: String,
    host: String,
    port: NSNumber,
    type: String,
    username: String,
    password: String,
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    let generatedId = UUID().uuidString
    resolve(generatedId)
  }

  @objc func deleteProfile(
    _ profileId: String,
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    resolve(NSNull())
  }

  @objc func startVPN(
    _ profileId: String,
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    reject("IOS_UNSUPPORTED", "startVPN requires a full profile on iOS", nil)
  }

  @objc func startVPNWithProfile(
    _ name: String,
    host: String,
    port: NSNumber,
    type: String,
    username: String,
    password: String,
    dns1: String?,
    dns2: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let profile = ProxyProfile(
      host: host,
      port: port.intValue,
      type: type,
      username: username,
      password: password,
      dns1: dns1,
      dns2: dns2
    )

    loadManager { [weak self] result in
      switch result {
      case .failure(let error):
        let message = self?.formatError(error as NSError) ?? error.localizedDescription
        self?.setErrorState(message)
        reject("VPN_MANAGER_ERROR", message, error)
      case .success(let manager):
        let status = manager.connection.status
        if status == .connected || status == .connecting || status == .reasserting {
          self?.updateCachedStatus(status)
          self?.emitStatusChanged()
          resolve(NSNull())
          return
        }
        self?.configureManager(manager, profile: profile) { error in
          if let error {
            let message = self?.formatError(error as NSError) ?? error.localizedDescription
            self?.setErrorState(message)
            reject("VPN_CONFIG_ERROR", message, error)
            return
          }
          manager.loadFromPreferences { loadError in
            if let loadError {
              let message = self?.formatError(loadError as NSError) ?? loadError.localizedDescription
              self?.setErrorState(message)
              reject("VPN_LOAD_ERROR", message, loadError)
              return
            }
            let status = manager.connection.status
            if status == .connected || status == .connecting || status == .reasserting {
              self?.updateCachedStatus(status)
              self?.emitStatusChanged()
              resolve(NSNull())
              return
            }
            self?.startTunnel(
              manager,
              retryOnStale: true,
              resolve: resolve,
              reject: reject
            )

            DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) { [weak self] in
              guard let self else { return }
              self.updateCachedStatus(manager.connection.status)
              if manager.connection.status == .disconnected {
                self.reportLastDisconnectError(manager)
                if self.cachedStatusState != "error" {
                  self.setErrorState("VPN did not start. Check Network Extension entitlements and provisioning.")
                }
              }
              self.emitStatusChanged()
            }
          }
        }
      }
    }
  }

  @objc func stopVPN(
    _ force: Bool,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    loadManager { [weak self] result in
      switch result {
      case .failure(let error):
        reject("VPN_MANAGER_ERROR", error.localizedDescription, error)
      case .success(let manager):
        manager.connection.stopVPNTunnel()
        self?.updateCachedStatus(manager.connection.status)
        self?.emitStatusChanged()
        resolve(NSNull())
      }
    }
  }

  @objc func getStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    loadManager { [weak self] result in
      switch result {
      case .failure(let error):
        reject("VPN_MANAGER_ERROR", error.localizedDescription, error)
      case .success(let manager):
        self?.updateCachedStatus(manager.connection.status)
        resolve(self?.statusPayload() ?? [:])
      }
    }
  }

  @objc func refreshStatus() {
    loadManager { [weak self] result in
      switch result {
      case .failure:
        break
      case .success(let manager):
        self?.updateCachedStatus(manager.connection.status)
        self?.emitStatusChanged()
      }
    }
  }

  @objc func setAutoConnectEnabled(
    _ enabled: Bool,
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    autoConnectEnabled = enabled
    resolve(NSNull())
  }

  @objc func getAutoConnectEnabled(
    _ resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    resolve(autoConnectEnabled)
  }

  @objc func openVPNSettings(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      guard let url = URL(string: UIApplication.openSettingsURLString) else {
        resolve(false)
        return
      }
      UIApplication.shared.open(url, options: [:]) { success in
        resolve(success)
      }
    }
  }

  @objc func prepareVPN(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    var completed = false
    let timeout = DispatchWorkItem { [weak self] in
      guard !completed else { return }
      completed = true
      self?.emitError("VPN permission request timed out")
      reject("VPN_PERMISSION_TIMEOUT", "VPN permission request timed out", nil)
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 10, execute: timeout)

    loadManager { [weak self] result in
      guard !completed else { return }
      switch result {
      case .failure(let error):
        completed = true
        timeout.cancel()
        let message = self?.formatError(error as NSError) ?? error.localizedDescription
        self?.setErrorState(message)
        reject("VPN_MANAGER_ERROR", message, error)
      case .success(let manager):
        self?.configureManager(manager, profile: nil) { error in
          guard !completed else { return }
          if let error {
            completed = true
            timeout.cancel()
            let message = self?.formatError(error as NSError) ?? error.localizedDescription
            self?.setErrorState(message)
            reject("VPN_CONFIG_ERROR", message, error)
            return
          }
          completed = true
          timeout.cancel()
          resolve(true)
        }
      }
    }
  }

  @objc func setPowerProfile(
    _ profile: String,
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    powerProfile = profile
    resolve(NSNull())
  }

  @objc func getPowerProfile(
    _ resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    resolve(powerProfile)
  }

  @objc func checkProxyHealth(
    _ type: String,
    host: String,
    port: NSNumber,
    username: String,
    password: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let proxyType = type.lowercased()
    let startTime = Date()
    let timeout: TimeInterval = 5.0
    let portValue = UInt16(truncating: port)

    DispatchQueue.global(qos: .utility).async { [weak self] in
      guard let self else { return }
      do {
        let result: (Bool, String?)
        if proxyType == "http" || proxyType == "https" {
          result = try self.checkHttpProxy(
            host: host,
            port: portValue,
            username: username,
            password: password,
            timeout: timeout
          )
        } else {
          result = try self.checkSocks5Proxy(
            host: host,
            port: portValue,
            username: username,
            password: password,
            timeout: timeout
          )
        }

        let latencyMs = Int(Date().timeIntervalSince(startTime) * 1000)
        let payload: [String: Any] = [
          "ok": result.0,
          "latencyMs": latencyMs,
          "ip": result.1 as Any,
        ]
        resolve(payload)
      } catch {
        let latencyMs = Int(Date().timeIntervalSince(startTime) * 1000)
        let payload: [String: Any] = [
          "ok": false,
          "latencyMs": latencyMs,
          "error": error.localizedDescription,
        ]
        resolve(payload)
      }
    }
  }
}
