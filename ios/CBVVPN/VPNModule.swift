import Foundation
import NetworkExtension
import React

@objc(VPNModule)
class VPNModule: RCTEventEmitter {

    private var vpnManager: VPNManager?
    private var hasListeners = false

    override init() {
        super.init()
        self.vpnManager = VPNManager(eventEmitter: self)
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    override func supportedEvents() -> [String]! {
        return ["statusChanged", "error", "profilesUpdated", "vpnPermissionRequired", "activeProfileChanged"]
    }

    override func startObserving() {
        hasListeners = true
    }

    override func stopObserving() {
        hasListeners = false
    }

    // MARK: - Profile Management

    @objc func getProfiles(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        ProfileStorage.shared.getProfiles { profiles, error in
            if let error = error {
                reject("GET_PROFILES_ERROR", error.localizedDescription, error)
                return
            }

            let profilesArray = profiles.map { profile in
                return [
                    "id": profile.id,
                    "name": profile.name,
                    "host": profile.host,
                    "port": profile.port,
                    "type": profile.type,
                    "hasAuth": !profile.username.isEmpty
                ]
            }
            resolve(profilesArray)
        }
    }

    @objc func saveProfile(
        _ name: String,
        host: String,
        port: NSNumber,
        type: String,
        username: String,
        password: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let profile = VPNProfile(
            id: UUID().uuidString,
            name: name,
            host: host,
            port: port.intValue,
            type: type,
            username: username,
            password: password
        )

        ProfileStorage.shared.saveProfile(profile) { savedProfile, error in
            if let error = error {
                reject("SAVE_PROFILE_ERROR", error.localizedDescription, error)
                return
            }

            if let savedProfile = savedProfile {
                self.sendEvent(withName: "profilesUpdated", body: [
                    "id": savedProfile.id,
                    "name": savedProfile.name,
                    "host": savedProfile.host,
                    "port": savedProfile.port,
                    "type": savedProfile.type,
                    "hasAuth": !savedProfile.username.isEmpty,
                    "isUpdate": false
                ])
                resolve(savedProfile.id)
            } else {
                reject("SAVE_PROFILE_ERROR", "Failed to save profile", nil)
            }
        }
    }

    @objc func deleteProfile(_ profileId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        ProfileStorage.shared.deleteProfile(profileId) { success, error in
            if let error = error {
                reject("DELETE_PROFILE_ERROR", error.localizedDescription, error)
                return
            }

            if success {
                self.sendEvent(withName: "profilesUpdated", body: [
                    "id": profileId,
                    "isUpdate": false
                ])
                resolve(nil)
            } else {
                reject("DELETE_PROFILE_ERROR", "Failed to delete profile", nil)
            }
        }
    }

    // MARK: - VPN Control

    @objc func startVPN(_ profileId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        ProfileStorage.shared.getProfile(profileId) { profile, error in
            if let error = error {
                reject("START_VPN_ERROR", error.localizedDescription, error)
                return
            }

            guard let profile = profile else {
                reject("START_VPN_ERROR", "Profile not found", nil)
                return
            }

            self.vpnManager?.startVPN(with: profile) { success, error in
                if let error = error {
                    reject("START_VPN_ERROR", error.localizedDescription, error)
                    return
                }
                resolve(nil)
            }
        }
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
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let profile = VPNProfile(
            id: UUID().uuidString,
            name: name,
            host: host,
            port: port.intValue,
            type: type,
            username: username,
            password: password,
            dns1: dns1,
            dns2: dns2
        )

        self.vpnManager?.startVPN(with: profile) { success, error in
            if let error = error {
                reject("START_VPN_ERROR", error.localizedDescription, error)
                return
            }
            resolve(nil)
        }
    }

    @objc func stopVPN(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        self.vpnManager?.stopVPN { success, error in
            if let error = error {
                reject("STOP_VPN_ERROR", error.localizedDescription, error)
                return
            }
            resolve(nil)
        }
    }

    @objc func getStatus(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        self.vpnManager?.getStatus { status, error in
            if let error = error {
                reject("GET_STATUS_ERROR", error.localizedDescription, error)
                return
            }
            resolve(status)
        }
    }

    @objc func refreshStatus() {
        self.vpnManager?.refreshStatus()
    }

    // MARK: - Event Sending

    func sendStatusEvent(_ status: [String: Any]) {
        if hasListeners {
            sendEvent(withName: "statusChanged", body: status)
        }
    }

    func sendErrorEvent(_ message: String) {
        if hasListeners {
            sendEvent(withName: "error", body: message)
        }
    }
}
