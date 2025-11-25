import Foundation
import Network

class SOCKS5ProxyHandler {
    private let proxyHost: String
    private let proxyPort: Int
    private let username: String?
    private let password: String?

    init(host: String, port: Int, username: String?, password: String?) {
        self.proxyHost = host
        self.proxyPort = port
        self.username = username
        self.password = password
    }

    // MARK: - SOCKS5 Protocol Constants

    private enum SOCKS5Constants {
        static let version: UInt8 = 0x05
        static let noAuth: UInt8 = 0x00
        static let usernamePassword: UInt8 = 0x02
        static let connectCommand: UInt8 = 0x01
        static let ipv4AddressType: UInt8 = 0x01
        static let domainAddressType: UInt8 = 0x03
        static let ipv6AddressType: UInt8 = 0x04
        static let success: UInt8 = 0x00
    }

    // MARK: - Connection

    func connect(to destinationHost: String, port: UInt16, completion: @escaping (NWConnection?, Error?) -> Void) {
        // Create connection to proxy server
        let endpoint = NWEndpoint.hostPort(
            host: NWEndpoint.Host(proxyHost),
            port: NWEndpoint.Port(integerLiteral: UInt16(proxyPort))
        )

        let parameters = NWParameters.tcp
        let connection = NWConnection(to: endpoint, using: parameters)

        connection.stateUpdateHandler = { state in
            switch state {
            case .ready:
                self.performSOCKS5Handshake(connection: connection, destinationHost: destinationHost, port: port, completion: completion)
            case .failed(let error):
                completion(nil, error)
            case .cancelled:
                completion(nil, NSError(domain: "SOCKS5", code: -1, userInfo: [NSLocalizedDescriptionKey: "Connection cancelled"]))
            default:
                break
            }
        }

        connection.start(queue: .global(qos: .userInitiated))
    }

    // MARK: - SOCKS5 Handshake

    private func performSOCKS5Handshake(connection: NWConnection, destinationHost: String, port: UInt16, completion: @escaping (NWConnection?, Error?) -> Void) {
        // Step 1: Send authentication methods
        sendAuthenticationMethods(connection: connection) { success, error in
            if let error = error {
                completion(nil, error)
                return
            }

            // Step 2: Receive authentication method selection
            self.receiveAuthMethodSelection(connection: connection) { selectedMethod, error in
                if let error = error {
                    completion(nil, error)
                    return
                }

                // Step 3: Perform authentication if required
                if selectedMethod == SOCKS5Constants.usernamePassword {
                    self.performUsernamePasswordAuth(connection: connection) { success, error in
                        if let error = error {
                            completion(nil, error)
                            return
                        }

                        // Step 4: Send connection request
                        self.sendConnectionRequest(connection: connection, destinationHost: destinationHost, port: port) { success, error in
                            if let error = error {
                                completion(nil, error)
                                return
                            }
                            completion(connection, nil)
                        }
                    }
                } else if selectedMethod == SOCKS5Constants.noAuth {
                    // Step 4: Send connection request (no auth)
                    self.sendConnectionRequest(connection: connection, destinationHost: destinationHost, port: port) { success, error in
                        if let error = error {
                            completion(nil, error)
                            return
                        }
                        completion(connection, nil)
                    }
                } else {
                    completion(nil, NSError(domain: "SOCKS5", code: -1, userInfo: [NSLocalizedDescriptionKey: "Unsupported authentication method"]))
                }
            }
        }
    }

    private func sendAuthenticationMethods(connection: NWConnection, completion: @escaping (Bool, Error?) -> Void) {
        var data = Data()
        data.append(SOCKS5Constants.version) // SOCKS version

        // Add authentication methods
        if username != nil && password != nil {
            data.append(0x02) // Number of methods
            data.append(SOCKS5Constants.noAuth)
            data.append(SOCKS5Constants.usernamePassword)
        } else {
            data.append(0x01) // Number of methods
            data.append(SOCKS5Constants.noAuth)
        }

        connection.send(content: data, completion: .contentProcessed { error in
            if let error = error {
                completion(false, error)
            } else {
                completion(true, nil)
            }
        })
    }

    private func receiveAuthMethodSelection(connection: NWConnection, completion: @escaping (UInt8?, Error?) -> Void) {
        connection.receive(minimumIncompleteLength: 2, maximumLength: 2) { data, _, _, error in
            if let error = error {
                completion(nil, error)
                return
            }

            guard let data = data, data.count == 2 else {
                completion(nil, NSError(domain: "SOCKS5", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"]))
                return
            }

            let version = data[0]
            let method = data[1]

            if version != SOCKS5Constants.version {
                completion(nil, NSError(domain: "SOCKS5", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid SOCKS version"]))
                return
            }

            if method == 0xFF {
                completion(nil, NSError(domain: "SOCKS5", code: -1, userInfo: [NSLocalizedDescriptionKey: "No acceptable authentication method"]))
                return
            }

            completion(method, nil)
        }
    }

    private func performUsernamePasswordAuth(connection: NWConnection, completion: @escaping (Bool, Error?) -> Void) {
        guard let username = username, let password = password else {
            completion(false, NSError(domain: "SOCKS5", code: -1, userInfo: [NSLocalizedDescriptionKey: "Username/password not provided"]))
            return
        }

        var data = Data()
        data.append(0x01) // Auth version
        data.append(UInt8(username.count))
        data.append(contentsOf: username.utf8)
        data.append(UInt8(password.count))
        data.append(contentsOf: password.utf8)

        connection.send(content: data, completion: .contentProcessed { error in
            if let error = error {
                completion(false, error)
                return
            }

            // Receive auth response
            connection.receive(minimumIncompleteLength: 2, maximumLength: 2) { data, _, _, error in
                if let error = error {
                    completion(false, error)
                    return
                }

                guard let data = data, data.count == 2 else {
                    completion(false, NSError(domain: "SOCKS5", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid auth response"]))
                    return
                }

                let status = data[1]
                if status == SOCKS5Constants.success {
                    completion(true, nil)
                } else {
                    completion(false, NSError(domain: "SOCKS5", code: -1, userInfo: [NSLocalizedDescriptionKey: "Authentication failed"]))
                }
            }
        })
    }

    private func sendConnectionRequest(connection: NWConnection, destinationHost: String, port: UInt16, completion: @escaping (Bool, Error?) -> Void) {
        var data = Data()
        data.append(SOCKS5Constants.version) // SOCKS version
        data.append(SOCKS5Constants.connectCommand) // CONNECT command
        data.append(0x00) // Reserved

        // Add destination address
        if let ipv4 = IPv4Address(destinationHost) {
            data.append(SOCKS5Constants.ipv4AddressType)
            data.append(contentsOf: ipv4.rawValue)
        } else if let ipv6 = IPv6Address(destinationHost) {
            data.append(SOCKS5Constants.ipv6AddressType)
            data.append(contentsOf: ipv6.rawValue)
        } else {
            // Domain name
            data.append(SOCKS5Constants.domainAddressType)
            data.append(UInt8(destinationHost.count))
            data.append(contentsOf: destinationHost.utf8)
        }

        // Add port
        data.append(UInt8(port >> 8))
        data.append(UInt8(port & 0xFF))

        connection.send(content: data, completion: .contentProcessed { error in
            if let error = error {
                completion(false, error)
                return
            }

            // Receive connection response
            connection.receive(minimumIncompleteLength: 4, maximumLength: 256) { data, _, _, error in
                if let error = error {
                    completion(false, error)
                    return
                }

                guard let data = data, data.count >= 4 else {
                    completion(false, NSError(domain: "SOCKS5", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid connection response"]))
                    return
                }

                let version = data[0]
                let status = data[1]

                if version != SOCKS5Constants.version {
                    completion(false, NSError(domain: "SOCKS5", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid SOCKS version in response"]))
                    return
                }

                if status != SOCKS5Constants.success {
                    let errorMessage = self.getSOCKS5ErrorMessage(status)
                    completion(false, NSError(domain: "SOCKS5", code: Int(status), userInfo: [NSLocalizedDescriptionKey: errorMessage]))
                    return
                }

                completion(true, nil)
            }
        })
    }

    private func getSOCKS5ErrorMessage(_ status: UInt8) -> String {
        switch status {
        case 0x01:
            return "General SOCKS server failure"
        case 0x02:
            return "Connection not allowed by ruleset"
        case 0x03:
            return "Network unreachable"
        case 0x04:
            return "Host unreachable"
        case 0x05:
            return "Connection refused"
        case 0x06:
            return "TTL expired"
        case 0x07:
            return "Command not supported"
        case 0x08:
            return "Address type not supported"
        default:
            return "Unknown SOCKS5 error: \(status)"
        }
    }
}
