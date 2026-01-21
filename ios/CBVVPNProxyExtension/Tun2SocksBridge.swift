import Foundation

enum Tun2SocksBridge {
  enum BridgeError: LocalizedError {
    case startFailed(Int32)

    var errorDescription: String? {
      switch self {
      case .startFailed(let code):
        return "Tun2Socks failed to start (code: \(code))"
      }
    }
  }

  static func start(config: ProxyConfiguration) throws {
    let port = Int32(config.port)
    let result = config.type.rawValue.withCString { typePtr in
      config.host.withCString { hostPtr in
        withOptionalCString(config.username) { userPtr in
          withOptionalCString(config.password) { passPtr in
            Tun2SocksStart(typePtr, hostPtr, port, userPtr, passPtr)
          }
        }
      }
    }

    if result != 0 {
      throw BridgeError.startFailed(result)
    }
  }

  static func stop() {
    Tun2SocksStop()
  }

  static func input(packet: Data) {
    packet.withUnsafeBytes { buffer in
      guard let baseAddress = buffer.baseAddress?.assumingMemoryBound(to: UInt8.self) else { return }
      _ = Tun2SocksInput(baseAddress, Int32(buffer.count))
    }
  }

  static func readPacket(into buffer: UnsafeMutablePointer<UInt8>, maxLength: Int) -> Int {
    return Int(Tun2SocksReadPacket(buffer, Int32(maxLength)))
  }

  private static func withOptionalCString<T>(_ value: String?, _ body: (UnsafePointer<CChar>?) -> T) -> T {
    guard let value, !value.isEmpty else {
      return body(nil)
    }
    return value.withCString { body($0) }
  }
}

@_silgen_name("Tun2SocksStart")
private func Tun2SocksStart(
  _ proxyType: UnsafePointer<CChar>,
  _ host: UnsafePointer<CChar>,
  _ port: Int32,
  _ username: UnsafePointer<CChar>?,
  _ password: UnsafePointer<CChar>?
) -> Int32

@_silgen_name("Tun2SocksStop")
private func Tun2SocksStop()

@_silgen_name("Tun2SocksInput")
private func Tun2SocksInput(_ data: UnsafePointer<UInt8>, _ length: Int32) -> Int32

@_silgen_name("Tun2SocksReadPacket")
private func Tun2SocksReadPacket(_ buffer: UnsafeMutablePointer<UInt8>, _ maxLength: Int32) -> Int32
