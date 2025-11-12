import Foundation

struct VPNProfile: Codable {
    let id: String
    let name: String
    let host: String
    let port: Int
    let type: String // "socks5" or "http"
    let username: String
    let password: String
    let dns1: String?
    let dns2: String?

    init(id: String, name: String, host: String, port: Int, type: String, username: String = "", password: String = "", dns1: String? = nil, dns2: String? = nil) {
        self.id = id
        self.name = name
        self.host = host
        self.port = port
        self.type = type
        self.username = username
        self.password = password
        self.dns1 = dns1
        self.dns2 = dns2
    }
}
