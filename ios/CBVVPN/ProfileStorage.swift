import Foundation

class ProfileStorage {
    static let shared = ProfileStorage()

    private let userDefaults: UserDefaults
    private let profilesKey = "vpn_profiles"

    private init() {
        if let sharedDefaults = UserDefaults(suiteName: "group.com.cbv.vpn") {
            self.userDefaults = sharedDefaults
        } else {
            self.userDefaults = UserDefaults.standard
        }
    }

    // MARK: - Profile Operations

    func getProfiles(completion: @escaping ([VPNProfile], Error?) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                guard let data = self.userDefaults.data(forKey: self.profilesKey) else {
                    DispatchQueue.main.async {
                        completion([], nil)
                    }
                    return
                }

                let profiles = try JSONDecoder().decode([VPNProfile].self, from: data)
                DispatchQueue.main.async {
                    completion(profiles, nil)
                }
            } catch {
                DispatchQueue.main.async {
                    completion([], error)
                }
            }
        }
    }

    func getProfile(_ profileId: String, completion: @escaping (VPNProfile?, Error?) -> Void) {
        getProfiles { profiles, error in
            if let error = error {
                completion(nil, error)
                return
            }

            let profile = profiles.first { $0.id == profileId }
            completion(profile, nil)
        }
    }

    func saveProfile(_ profile: VPNProfile, completion: @escaping (VPNProfile?, Error?) -> Void) {
        getProfiles { profiles, error in
            if let error = error {
                completion(nil, error)
                return
            }

            var updatedProfiles = profiles
            if let index = updatedProfiles.firstIndex(where: { $0.id == profile.id }) {
                updatedProfiles[index] = profile
            } else {
                updatedProfiles.append(profile)
            }

            do {
                let data = try JSONEncoder().encode(updatedProfiles)
                self.userDefaults.set(data, forKey: self.profilesKey)
                self.userDefaults.synchronize()
                completion(profile, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    func deleteProfile(_ profileId: String, completion: @escaping (Bool, Error?) -> Void) {
        getProfiles { profiles, error in
            if let error = error {
                completion(false, error)
                return
            }

            let updatedProfiles = profiles.filter { $0.id != profileId }

            do {
                let data = try JSONEncoder().encode(updatedProfiles)
                self.userDefaults.set(data, forKey: self.profilesKey)
                self.userDefaults.synchronize()
                completion(true, nil)
            } catch {
                completion(false, error)
            }
        }
    }

    // MARK: - Active Profile

    func setActiveProfile(_ profile: VPNProfile) {
        do {
            let data = try JSONEncoder().encode(profile)
            userDefaults.set(data, forKey: "active_profile")
            userDefaults.synchronize()
        } catch {
            print("Error saving active profile: \(error)")
        }
    }

    func getActiveProfile() -> VPNProfile? {
        guard let data = userDefaults.data(forKey: "active_profile") else {
            return nil
        }

        do {
            return try JSONDecoder().decode(VPNProfile.self, from: data)
        } catch {
            print("Error loading active profile: \(error)")
            return nil
        }
    }

    func clearActiveProfile() {
        userDefaults.removeObject(forKey: "active_profile")
        userDefaults.synchronize()
    }
}
