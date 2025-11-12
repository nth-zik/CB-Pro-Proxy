import Foundation
import Network

class HTTPProxyHandler {
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
                self.performHTTPConnect(connection: connection, destinationHost: destinationHost, port: port, completion: completion)
            case .failed(let error):
                completion(nil, error)
            case .cancelled:
                completion(nil, NSError(domain: "HTTPProxy", code: -1, userInfo: [NSLocalizedDescriptionKey: "Connection cancelled"]))
            default:
                break
            }
        }

        connection.start(queue: .global(qos: .userInitiated))
    }

    // MARK: - HTTP CONNECT

    private func performHTTPConnect(connection: NWConnection, destinationHost: String, port: UInt16, completion: @escaping (NWConnection?, Error?) -> Void) {
        // Build CONNECT request
        var request = "CONNECT \(destinationHost):\(port) HTTP/1.1\r\n"
        request += "Host: \(destinationHost):\(port)\r\n"

        // Add Proxy-Authorization if credentials are provided
        if let username = username, let password = password, !username.isEmpty {
            let credentials = "\(username):\(password)"
            if let credentialsData = credentials.data(using: .utf8) {
                let base64Credentials = credentialsData.base64EncodedString()
                request += "Proxy-Authorization: Basic \(base64Credentials)\r\n"
            }
        }

        request += "Connection: keep-alive\r\n"
        request += "\r\n"

        guard let requestData = request.data(using: .utf8) else {
            completion(nil, NSError(domain: "HTTPProxy", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to encode request"]))
            return
        }

        // Send CONNECT request
        connection.send(content: requestData, completion: .contentProcessed { error in
            if let error = error {
                completion(nil, error)
                return
            }

            // Receive response
            self.receiveHTTPResponse(connection: connection, completion: completion)
        })
    }

    private func receiveHTTPResponse(connection: NWConnection, completion: @escaping (NWConnection?, Error?) -> Void) {
        var receivedData = Data()

        func receiveMore() {
            connection.receive(minimumIncompleteLength: 1, maximumLength: 4096) { data, _, _, error in
                if let error = error {
                    completion(nil, error)
                    return
                }

                guard let data = data else {
                    completion(nil, NSError(domain: "HTTPProxy", code: -1, userInfo: [NSLocalizedDescriptionKey: "No data received"]))
                    return
                }

                receivedData.append(data)

                // Check if we have received the complete HTTP response headers
                if let responseString = String(data: receivedData, encoding: .utf8),
                   responseString.contains("\r\n\r\n") {
                    // Parse response
                    self.parseHTTPResponse(responseString, connection: connection, completion: completion)
                } else {
                    // Continue receiving
                    receiveMore()
                }
            }
        }

        receiveMore()
    }

    private func parseHTTPResponse(_ response: String, connection: NWConnection, completion: @escaping (NWConnection?, Error?) -> Void) {
        let lines = response.components(separatedBy: "\r\n")

        guard let statusLine = lines.first else {
            completion(nil, NSError(domain: "HTTPProxy", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid HTTP response"]))
            return
        }

        // Parse status line: HTTP/1.1 200 Connection established
        let statusComponents = statusLine.components(separatedBy: " ")
        guard statusComponents.count >= 2,
              let statusCode = Int(statusComponents[1]) else {
            completion(nil, NSError(domain: "HTTPProxy", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid HTTP status line"]))
            return
        }

        if statusCode == 200 {
            // Connection established successfully
            completion(connection, nil)
        } else {
            // Parse status message
            let statusMessage = statusComponents.dropFirst(2).joined(separator: " ")
            let errorMessage = "HTTP Proxy error \(statusCode): \(statusMessage)"
            completion(nil, NSError(domain: "HTTPProxy", code: statusCode, userInfo: [NSLocalizedDescriptionKey: errorMessage]))
        }
    }

    // MARK: - Helper Methods

    private func getHTTPErrorMessage(_ statusCode: Int) -> String {
        switch statusCode {
        case 400:
            return "Bad Request"
        case 401:
            return "Unauthorized - Invalid proxy credentials"
        case 403:
            return "Forbidden"
        case 404:
            return "Not Found"
        case 407:
            return "Proxy Authentication Required"
        case 500:
            return "Internal Server Error"
        case 502:
            return "Bad Gateway"
        case 503:
            return "Service Unavailable"
        case 504:
            return "Gateway Timeout"
        default:
            return "HTTP Error \(statusCode)"
        }
    }
}
