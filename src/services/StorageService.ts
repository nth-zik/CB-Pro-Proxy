import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { ProxyProfile, StoredProfile, StoredCredentials } from "../types";
import { VPNModule } from "../native/VPNModule";

/**
 * StorageService quản lý việc lưu trữ profiles và credentials
 * - Metadata (profiles) được lưu trong AsyncStorage
 * - Credentials (username/password) được lưu trong SecureStore (encrypted)
 */
export class StorageService {
  private static readonly PROFILES_KEY = "@cbv_vpn_profiles";
  private static readonly CREDENTIALS_PREFIX = "cbv_vpn_creds_";

  /**
   * Lưu một profile mới hoặc cập nhật profile hiện có
   */
  async saveProfile(profile: ProxyProfile): Promise<void> {
    try {
      // Lấy danh sách profiles hiện tại
      const profiles = await this.getProfiles();

      // Kiểm tra xem profile đã tồn tại chưa
      const existingIndex = profiles.findIndex((p) => p.id === profile.id);

      if (existingIndex >= 0) {
        // Cập nhật profile hiện có
        profiles[existingIndex] = profile;
      } else {
        // Thêm profile mới
        profiles.push(profile);
      }

      // Lưu metadata (không bao gồm credentials)
      const storedProfiles: StoredProfile[] = profiles.map((p) => ({
        id: p.id,
        name: p.name,
        host: p.host,
        port: p.port,
        type: p.type,
        hasAuth: !!(p.username && p.password),
      }));

      await AsyncStorage.setItem(
        StorageService.PROFILES_KEY,
        JSON.stringify(storedProfiles)
      );

      // Sync to native module
      try {
        await VPNModule.saveProfile(
          profile.name,
          profile.host,
          profile.port,
          profile.type,
          profile.username || "",
          profile.password || ""
        );
        console.log("✅ Profile synced to native:", profile.id);
      } catch (error) {
        console.warn("⚠️ Failed to sync profile to native:", error);
      }

      // Lưu credentials riêng biệt trong SecureStore nếu có
      if (profile.username && profile.password) {
        const credentials: StoredCredentials = {
          profileId: profile.id,
          username: profile.username,
          password: profile.password,
        };

        const sanitizedId = this.sanitizeKey(profile.id);
        await SecureStore.setItemAsync(
          `${StorageService.CREDENTIALS_PREFIX}${sanitizedId}`,
          JSON.stringify(credentials)
        );
      } else {
        // Xóa credentials nếu không còn authentication
        await this.deleteCredentials(profile.id);
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      throw new Error("Failed to save profile");
    }
  }

  /**
   * Lấy tất cả profiles
   */
  async getProfiles(): Promise<ProxyProfile[]> {
    try {
      // Parallelize sync from native and AsyncStorage read for better performance
      const [, storedData] = await Promise.all([
        this.syncFromNative(),
        AsyncStorage.getItem(StorageService.PROFILES_KEY),
      ]);

      if (!storedData) {
        return [];
      }

      const storedProfiles: StoredProfile[] = JSON.parse(storedData);

      // Kết hợp metadata với credentials
      const profiles: ProxyProfile[] = await Promise.all(
        storedProfiles.map(async (stored) => {
          let username: string | undefined;
          let password: string | undefined;

          if (stored.hasAuth) {
            const credentials = await this.getCredentials(stored.id);
            if (credentials) {
              username = credentials.username;
              password = credentials.password;
            }
          }

          return {
            id: stored.id,
            name: stored.name,
            host: stored.host,
            port: stored.port,
            type: stored.type,
            username,
            password,
            createdAt: new Date(), // Placeholder - có thể lưu timestamp thực tế
            updatedAt: new Date(),
          };
        })
      );

      return profiles;
    } catch (error) {
      console.error("Error getting profiles:", error);
      throw new Error("Failed to load profiles");
    }
  }

  /**
   * Sync profiles from native module (SharedPreferences) to AsyncStorage
   */
  private async syncFromNative(): Promise<void> {
    try {
      // Get profiles from native module
      const nativeProfiles = await VPNModule.getProfiles();

      if (!nativeProfiles || nativeProfiles.length === 0) {
        return;
      }

      // Get current profiles from AsyncStorage
      const storedData = await AsyncStorage.getItem(
        StorageService.PROFILES_KEY
      );
      const currentProfiles: StoredProfile[] = storedData
        ? JSON.parse(storedData)
        : [];

      // Create a map of current profiles by ID
      const currentProfilesMap = new Map(currentProfiles.map((p) => [p.id, p]));

      // Add new profiles from native or update existing ones
      let hasChanges = false;
      for (const nativeProfile of nativeProfiles) {
        const existingProfile = currentProfilesMap.get(nativeProfile.id);

        if (!existingProfile) {
          // New profile
          currentProfiles.push({
            id: nativeProfile.id,
            name: nativeProfile.name,
            host: nativeProfile.host,
            port: nativeProfile.port,
            type: nativeProfile.type,
            hasAuth: !!(nativeProfile.username && nativeProfile.password),
          });

          // Save credentials if present
          if (nativeProfile.username && nativeProfile.password) {
            const credentials: StoredCredentials = {
              profileId: nativeProfile.id,
              username: nativeProfile.username,
              password: nativeProfile.password,
            };
            const sanitizedId = this.sanitizeKey(nativeProfile.id);
            await SecureStore.setItemAsync(
              `${StorageService.CREDENTIALS_PREFIX}${sanitizedId}`,
              JSON.stringify(credentials)
            );
          }

          hasChanges = true;
          console.log("✅ Synced new profile from native:", nativeProfile.name);
        } else {
          // Check for updates
          const hasAuth = !!(nativeProfile.username && nativeProfile.password);
          const isDifferent =
            existingProfile.name !== nativeProfile.name ||
            existingProfile.host !== nativeProfile.host ||
            existingProfile.port !== nativeProfile.port ||
            existingProfile.type !== nativeProfile.type ||
            existingProfile.hasAuth !== hasAuth;

          if (isDifferent) {
            // Update existing profile metadata
            existingProfile.name = nativeProfile.name;
            existingProfile.host = nativeProfile.host;
            existingProfile.port = nativeProfile.port;
            existingProfile.type = nativeProfile.type;
            existingProfile.hasAuth = hasAuth;

            // Find index and update in array
            const index = currentProfiles.findIndex(
              (p) => p.id === nativeProfile.id
            );
            if (index !== -1) {
              currentProfiles[index] = existingProfile;
            }

            hasChanges = true;
            console.log(
              "✏️ Synced updated profile from native:",
              nativeProfile.name
            );
          }

          // Always check/update credentials if auth is present
          // We can't easily check if credentials changed without reading SecureStore,
          // so we just overwrite if provided by native
          if (nativeProfile.username && nativeProfile.password) {
            const credentials: StoredCredentials = {
              profileId: nativeProfile.id,
              username: nativeProfile.username,
              password: nativeProfile.password,
            };
            const sanitizedId = this.sanitizeKey(nativeProfile.id);
            await SecureStore.setItemAsync(
              `${StorageService.CREDENTIALS_PREFIX}${sanitizedId}`,
              JSON.stringify(credentials)
            );
          } else if (!hasAuth && existingProfile.hasAuth) {
            // If native has no auth but we thought it did, clear credentials
            await this.deleteCredentials(nativeProfile.id);
          }
        }
      }

      // Save updated profiles if there were changes
      if (hasChanges) {
        await AsyncStorage.setItem(
          StorageService.PROFILES_KEY,
          JSON.stringify(currentProfiles)
        );
        console.log("✅ Profiles synced from native to AsyncStorage");
      }
    } catch (error) {
      console.warn("⚠️ Failed to sync profiles from native:", error);
      // Don't throw - allow app to continue with existing profiles
    }
  }

  /**
   * Lấy một profile theo ID
   */
  async getProfile(id: string): Promise<ProxyProfile | null> {
    try {
      const profiles = await this.getProfiles();
      return profiles.find((p) => p.id === id) || null;
    } catch (error) {
      console.error("Error getting profile:", error);
      return null;
    }
  }

  /**
   * Xóa một profile
   */
  async deleteProfile(id: string): Promise<void> {
    try {
      const profiles = await this.getProfiles();
      const filteredProfiles = profiles.filter((p) => p.id !== id);

      // Lưu danh sách profiles đã lọc
      const storedProfiles: StoredProfile[] = filteredProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        host: p.host,
        port: p.port,
        type: p.type,
        hasAuth: !!(p.username && p.password),
      }));

      await AsyncStorage.setItem(
        StorageService.PROFILES_KEY,
        JSON.stringify(storedProfiles)
      );

      // Sync to native module
      try {
        await VPNModule.deleteProfile(id);
        console.log("✅ Profile deleted from native:", id);
      } catch (error) {
        console.warn("⚠️ Failed to delete profile from native:", error);
      }

      // Xóa credentials
      await this.deleteCredentials(id);
    } catch (error) {
      console.error("Error deleting profile:", error);
      throw new Error("Failed to delete profile");
    }
  }

  /**
   * Cập nhật một profile hiện có
   */
  async updateProfile(profile: ProxyProfile): Promise<void> {
    // updateProfile giống saveProfile trong implementation này
    await this.saveProfile(profile);
  }

  /**
   * Sanitize key để phù hợp với SecureStore requirements
   * Keys must contain only alphanumeric characters, ".", "-", and "_"
   */
  private sanitizeKey(key: string): string {
    if (!key || key.trim() === "") {
      throw new Error("Profile ID cannot be empty");
    }

    const sanitized = key.replace(/[^a-zA-Z0-9._-]/g, "_");

    // Ensure key is not empty after sanitization
    if (sanitized === "" || sanitized.trim() === "") {
      // Use a hash or fallback if all characters were invalid
      return `profile_${Date.now()}`;
    }

    return sanitized;
  }

  /**
   * Lấy credentials cho một profile
   */
  private async getCredentials(
    profileId: string
  ): Promise<StoredCredentials | null> {
    try {
      if (!profileId || profileId.trim() === "") {
        console.warn("Empty profile ID provided to getCredentials");
        return null;
      }

      const sanitizedId = this.sanitizeKey(profileId);
      const key = `${StorageService.CREDENTIALS_PREFIX}${sanitizedId}`;

      const credentialsData = await SecureStore.getItemAsync(key);

      if (!credentialsData) {
        return null;
      }

      return JSON.parse(credentialsData);
    } catch (error) {
      console.error("Error getting credentials for profile:", profileId, error);
      return null;
    }
  }

  /**
   * Xóa credentials cho một profile
   */
  private async deleteCredentials(profileId: string): Promise<void> {
    try {
      if (!profileId || profileId.trim() === "") {
        console.warn("Empty profile ID provided to deleteCredentials");
        return;
      }

      const sanitizedId = this.sanitizeKey(profileId);
      const key = `${StorageService.CREDENTIALS_PREFIX}${sanitizedId}`;

      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      // Không throw error nếu credentials không tồn tại
      console.warn("Error deleting credentials for profile:", profileId, error);
    }
  }

  /**
   * Xóa tất cả dữ liệu (dùng cho testing hoặc reset app)
   */
  async clearAll(): Promise<void> {
    try {
      const profiles = await this.getProfiles();

      // Xóa tất cả credentials
      await Promise.all(profiles.map((p) => this.deleteCredentials(p.id)));

      // Xóa profiles metadata
      await AsyncStorage.removeItem(StorageService.PROFILES_KEY);
    } catch (error) {
      console.error("Error clearing all data:", error);
      throw new Error("Failed to clear all data");
    }
  }
}

// Export singleton instance
export const storageService = new StorageService();
