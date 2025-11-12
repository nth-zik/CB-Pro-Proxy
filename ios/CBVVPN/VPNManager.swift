import Foundation
import NetworkExtension

class VPNManager {
    private weak var eventEmitter: VPNModule?
    private var vpnManager: NEVPNManager?
    private var connectionStartTime: Date?
    private var statusTimer: Timer?

    init(eventEmitter: VPNModule) {
        self.eventEmitter = eventEmitter
        setupVPNManager()
        observeVPNStatus()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        statusTimer?.invalidate()
    }

    // MARK: - Setup

    private func setupVPNManager() {
        NETunnelProviderManager.loadAllFromPreferences { managers, error in
            if let error = error {
                print("Error loading VPN preferences: \(error)")
                return
            }

            if let manager = managers?.first {
                self.vpnManager = manager
            } else {
                let manager = NETunnelProviderManager()
                self.vpnManager = manager
            }
        }
    }

    // MARK: - VPN Control

    func startVPN(with profile: VPNProfile, completion: @escaping (Bool, Error?) -> Void) {
        NETunnelProviderManager.loadAllFromPreferences { [weak self] managers, error in
            guard let self = self else { return }

            if let error = error {
                completion(false, error)
                return
            }

            let manager = managers?.first ?? NETunnelProviderManager()

            // Configure protocol
            let protocolConfiguration = NETunnelProviderProtocol()
            protocolConfiguration.providerBundleIdentifier = "com.cbv.vpn.PacketTunnel"
            protocolConfiguration.serverAddress = profile.host

            // Pass profile configuration to the extension
            protocolConfiguration.providerConfiguration = [
                "host": profile.host,
                "port": profile.port,
                "type": profile.type,
                "username": profile.username,
                "password": profile.password,
                "dns1": profile.dns1 ?? "1.1.1.1",
                "dns2": profile.dns2 ?? "8.8.8.8"
            ] as [String: Any]

            manager.protocolConfiguration = protocolConfiguration
            manager.localizedDescription = profile.name
            manager.isEnabled = true

            // Configure on-demand rules (optional)
            manager.isOnDemandEnabled = false

            // Save configuration
            manager.saveToPreferences { error in
                if let error = error {
                    completion(false, error)
                    return
                }

                // Reload to get the saved configuration
                manager.loadFromPreferences { error in
                    if let error = error {
                        completion(false, error)
                        return
                    }

                    self.vpnManager = manager

                    // Start the VPN connection
                    do {
                        try manager.connection.startVPNTunnel()
                        self.connectionStartTime = Date()
                        ProfileStorage.shared.setActiveProfile(profile)
                        self.startStatusTimer()
                        completion(true, nil)
                    } catch {
                        completion(false, error)
                    }
                }
            }
        }
    }

    func stopVPN(completion: @escaping (Bool, Error?) -> Void) {
        guard let manager = vpnManager else {
            completion(false, NSError(domain: "VPNManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "VPN Manager not initialized"]))
            return
        }

        manager.connection.stopVPNTunnel()
        connectionStartTime = nil
        ProfileStorage.shared.clearActiveProfile()
        statusTimer?.invalidate()
        statusTimer = nil
        completion(true, nil)
    }

    func getStatus(completion: @escaping ([String: Any], Error?) -> Void) {
        guard let manager = vpnManager else {
            completion([
                "state": "disconnected",
                "isConnected": false,
                "durationMillis": 0,
                "bytesUp": 0,
                "bytesDown": 0
            ], nil)
            return
        }

        let connection = manager.connection
        let status = convertStatus(connection.status)

        var statusDict: [String: Any] = [
            "state": status,
            "isConnected": connection.status == .connected,
            "durationMillis": getDuration(),
            "bytesUp": 0, // Will be updated by packet tunnel provider
            "bytesDown": 0  // Will be updated by packet tunnel provider
        ]

        completion(statusDict, nil)
    }

    func refreshStatus() {
        getStatus { status, error in
            if let error = error {
                self.eventEmitter?.sendErrorEvent("Failed to refresh status: \(error.localizedDescription)")
                return
            }
            self.eventEmitter?.sendStatusEvent(status)
        }
    }

    // MARK: - Status Observation

    private func observeVPNStatus() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(vpnStatusDidChange),
            name: .NEVPNStatusDidChange,
            object: nil
        )
    }

    @objc private func vpnStatusDidChange(_ notification: Notification) {
        guard let connection = notification.object as? NEVPNConnection else { return }

        let status = convertStatus(connection.status)
        let isConnected = connection.status == .connected

        if isConnected && connectionStartTime == nil {
            connectionStartTime = Date()
            startStatusTimer()
        } else if !isConnected {
            connectionStartTime = nil
            statusTimer?.invalidate()
            statusTimer = nil
        }

        let statusDict: [String: Any] = [
            "state": status,
            "isConnected": isConnected,
            "durationMillis": getDuration(),
            "bytesUp": 0,
            "bytesDown": 0
        ]

        eventEmitter?.sendStatusEvent(statusDict)
    }

    private func startStatusTimer() {
        statusTimer?.invalidate()
        statusTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.refreshStatus()
        }
    }

    // MARK: - Helpers

    private func convertStatus(_ status: NEVPNStatus) -> String {
        switch status {
        case .invalid:
            return "disconnected"
        case .disconnected:
            return "disconnected"
        case .connecting:
            return "connecting"
        case .connected:
            return "connected"
        case .reasserting:
            return "handshaking"
        case .disconnecting:
            return "disconnecting"
        @unknown default:
            return "disconnected"
        }
    }

    private func getDuration() -> Int64 {
        guard let startTime = connectionStartTime else { return 0 }
        return Int64(Date().timeIntervalSince(startTime) * 1000)
    }
}
