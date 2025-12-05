import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { ProxyProfile, StoredProfile, StoredCredentials } from "../types";
import { VPNModule } from "../native/VPNModule";
import { databaseService } from "./DatabaseService";
import { profileRepository } from "../repositories/ProfileRepository";
import { nativeSyncService } from "./NativeSyncService";
import { migrationService } from "./MigrationService";
import { logger } from "./LoggerService";

/**
 * StorageService manages profile and credential storage
 * - Supports both AsyncStorage (legacy) and SQLite (new)
 * - Feature flag: USE_SQLITE_STORAGE enables SQLite mode
 * - Dual-write mode: writes to both storages during transition
 * - Credentials always stored in SecureStore (encrypted)
 */
export class StorageService {
  private static readonly PROFILES_KEY = "@cbv_vpn_profiles";
  private static readonly CREDENTIALS_PREFIX = "cbv_vpn_creds_";
  private static readonly FEATURE_FLAG_KEY = "@cbv_vpn_use_sqlite";
  
  private useSQLite: boolean = false;
  private dualWriteMode: boolean = true;
  private initialized: boolean = false;

  /**
   * Initialize storage service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const flagValue = await AsyncStorage.getItem(StorageService.FEATURE_FLAG_KEY);
      this.useSQLite = flagValue === "true";

      if (this.useSQLite) {
        await databaseService.initialize();
        
        const migrationCompleted = await migrationService.isMigrationCompleted();
        if (!migrationCompleted) {
          logger.info("Running migration from AsyncStorage to SQLite", "database");
          const result = await migrationService.migrate();
          if (!result.success) {
            logger.error("Migration failed, falling back to AsyncStorage", "database");
            this.useSQLite = false;
            await AsyncStorage.setItem(StorageService.FEATURE_FLAG_KEY, "false");
          }
        }
      }

      this.initialized = true;
      logger.info("StorageService initialized", "storage", {
        useSQLite: this.useSQLite,
        dualWriteMode: this.dualWriteMode,
      });
    } catch (error) {
      logger.error("Failed to initialize StorageService", "storage", error as Error);
      this.useSQLite = false;
      this.initialized = true;
    }
  }

  /**
   * Enable SQLite storage
   */
  async enableSQLite(): Promise<void> {
    await AsyncStorage.setItem(StorageService.FEATURE_FLAG_KEY, "true");
    this.useSQLite = true;
    await this.initialize();
  }

  /**
   * Disable SQLite storage
   */
  async disableSQLite(): Promise<void> {
    // if currently using SQLite, migrate data back to AsyncStorage first
    if (this.useSQLite) {
      try {
        logger.info("Disabling SQLite mode - migrating data back to AsyncStorage", "storage");

        // Ensure repository is available and database is initialized
        const profiles = await profileRepository.getAll();

        // Map to StoredProfile format
        const storedProfiles: StoredProfile[] = profiles.map((p) => ({
          id: p.id,
          name: p.name,
          host: p.host,
          port: p.port,
          type: p.type,
          hasAuth: !!(p.username && p.password),
          tags: p.tags,
        }));

        // Write to AsyncStorage atomically
        await AsyncStorage.setItem(StorageService.PROFILES_KEY, JSON.stringify(storedProfiles));

        // Close database connection
        try {
          await databaseService.close();
        } catch (err) {
          logger.warn("Failed to close database while disabling SQLite", "database", err as Error);
        }
      } catch (error) {
        logger.error("Failed to migrate profiles from SQLite to AsyncStorage", "storage", error as Error);
        // We still want to proceed to disable SQLite flag to avoid leaving the app in a broken state
      }
      // Reset initialization so future initialize() runs appropriately
      this.initialized = false;
    }

    await AsyncStorage.setItem(StorageService.FEATURE_FLAG_KEY, "false");
    this.useSQLite = false;
  }

  /**
   * Check if SQLite is enabled
   */
  isSQLiteEnabled(): boolean {
    return this.useSQLite;
  }

  /**
   * Save a profile (create or update)
   */
  async saveProfile(profile: ProxyProfile): Promise<void> {
    await this.initialize();
    try {
      if (this.useSQLite) {
        const existing = await profileRepository.getById(profile.id);
        if (existing) {
          await profileRepository.update(profile);
        } else {
          await profileRepository.create(profile);
        }
        
        await nativeSyncService.queueSync(profile.id, existing ? "update" : "create");
        await nativeSyncService.processSyncQueue();
      }

      if (!this.useSQLite || this.dualWriteMode) {
        const profiles = await this.getProfilesFromAsyncStorage();
        const existingIndex = profiles.findIndex((p) => p.id === profile.id);

        if (existingIndex >= 0) {
          profiles[existingIndex] = profile;
        } else {
          profiles.push(profile);
        }

        const storedProfiles: StoredProfile[] = profiles.map((p) => ({
          id: p.id,
          name: p.name,
          host: p.host,
          port: p.port,
          type: p.type,
          hasAuth: !!(p.username && p.password),
          tags: p.tags,
        }));

        await AsyncStorage.setItem(
          StorageService.PROFILES_KEY,
          JSON.stringify(storedProfiles)
        );

        try {
          await VPNModule.saveProfile(
            profile.name,
            profile.host,
            profile.port,
            profile.type,
            profile.username || "",
            profile.password || ""
          );
        } catch (error) {
          logger.warn("Failed to sync profile to native", "native", {
            profileId: profile.id,
            error: (error as Error).message,
          });
        }
      }

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
        await this.deleteCredentials(profile.id);
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      throw new Error("Failed to save profile");
    }
  }

  /**
   * Lưu nhiều profile cùng lúc (Bulk save)
   */
  async saveProfiles(newProfiles: ProxyProfile[]): Promise<void> {
    if (!newProfiles || newProfiles.length === 0) return;

    try {
      const currentProfiles = await this.getProfiles();
      const combinedProfiles = [...currentProfiles];
      const profileMap = new Map(combinedProfiles.map((p) => [p.id, p]));

      // Merge new profiles
      for (const profile of newProfiles) {
        profileMap.set(profile.id, profile);
      }

      const finalProfiles = Array.from(profileMap.values());

      // Save metadata to AsyncStorage in one go
      const storedProfiles: StoredProfile[] = finalProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        host: p.host,
        port: p.port,
        type: p.type,
        hasAuth: !!(p.username && p.password),
        tags: p.tags,
      }));

      await AsyncStorage.setItem(
        StorageService.PROFILES_KEY,
        JSON.stringify(storedProfiles)
      );

      // Sync to native module and save credentials
      // We parallelize these operations for speed since they are independent per profile
      const tasks = newProfiles.map(async (profile) => {
        try {
          await VPNModule.saveProfile(
            profile.name,
            profile.host,
            profile.port,
            profile.type,
            profile.username || "",
            profile.password || ""
          );
        } catch (error) {
          console.warn(
            "⚠️ Failed to sync profile to native:",
            profile.id,
            error
          );
        }

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
        }
      });

      await Promise.all(tasks);

      console.log(`✅ Bulk saved ${newProfiles.length} profiles`);
    } catch (error) {
      console.error("Error bulk saving profiles:", error);
      throw new Error("Failed to bulk save profiles");
    }
  }

  /**
   * Helper method to get profiles from AsyncStorage only
   */
  private async getProfilesFromAsyncStorage(): Promise<ProxyProfile[]> {
    const storedData = await AsyncStorage.getItem(StorageService.PROFILES_KEY);
    if (!storedData) {
      return [];
    }

    const storedProfiles: StoredProfile[] = JSON.parse(storedData);
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
          tags: stored.tags,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      })
    );

    return profiles;
  }

  /**
   * Get all profiles
   */
  async getProfiles(syncNative: boolean = false): Promise<ProxyProfile[]> {
    await this.initialize();

    try {
      if (syncNative) {
        await this.syncFromNative();
      }

      if (this.useSQLite) {
        return await profileRepository.getAll();
      }

      return await this.getProfilesFromAsyncStorage();
    } catch (error) {
      logger.error("Error getting profiles", "storage", error as Error);
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
    await this.initialize();

    try {
      if (this.useSQLite) {
        await profileRepository.delete(id);
        await nativeSyncService.queueSync(id, "delete");
        await nativeSyncService.processSyncQueue();
      }

      if (!this.useSQLite || this.dualWriteMode) {
        const profiles = await this.getProfilesFromAsyncStorage();
        const filteredProfiles = profiles.filter((p: ProxyProfile) => p.id !== id);

        const storedProfiles: StoredProfile[] = filteredProfiles.map((p: ProxyProfile) => ({
          id: p.id,
          name: p.name,
          host: p.host,
          port: p.port,
          type: p.type,
          hasAuth: !!(p.username && p.password),
          tags: p.tags,
        }));

        await AsyncStorage.setItem(
          StorageService.PROFILES_KEY,
          JSON.stringify(storedProfiles)
        );

        try {
          await VPNModule.deleteProfile(id);
        } catch (error) {
          logger.warn("Failed to delete profile from native", "native", {
            profileId: id,
            error: (error as Error).message,
          });
        }
      }

      await this.deleteCredentials(id);
    } catch (error) {
      logger.error("Error deleting profile", "storage", error as Error, { profileId: id });
      throw new Error("Failed to delete profile");
    }
  }

  /**
   * Bulk delete profiles
   */
  async bulkDeleteProfiles(ids: string[]): Promise<import("../types/database").BulkOperationResult> {
    await this.initialize();

    const result: import("../types/database").BulkOperationResult = {
      success: true,
      totalCount: ids.length,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    if (ids.length === 0) {
      return result;
    }

    try {
      if (this.useSQLite) {
        // Use batch operations for SQLite (15-40x faster)
        const batchResult = await profileRepository.bulkDelete(ids);
        
        // Queue native sync operations
        for (const id of ids) {
          await nativeSyncService.queueSync(id, "delete");
        }
        await nativeSyncService.processSyncQueue();
        
        return batchResult;
      }

      // Fallback to sequential deletion for AsyncStorage mode
      if (!this.useSQLite || this.dualWriteMode) {
        const profiles = await this.getProfilesFromAsyncStorage();
        const remainingProfiles = profiles.filter((p: ProxyProfile) => !ids.includes(p.id));

        const storedProfiles: StoredProfile[] = remainingProfiles.map((p: ProxyProfile) => ({
          id: p.id,
          name: p.name,
          host: p.host,
          port: p.port,
          type: p.type,
          hasAuth: !!(p.username && p.password),
          tags: p.tags,
        }));

        await AsyncStorage.setItem(
          StorageService.PROFILES_KEY,
          JSON.stringify(storedProfiles)
        );

        // Delete from native module and credentials sequentially
        for (const id of ids) {
          try {
            await VPNModule.deleteProfile(id);
            await this.deleteCredentials(id);
            result.successCount++;
          } catch (error) {
            result.failureCount++;
            result.errors.push({
              id,
              error: (error as Error).message,
            });
            logger.warn("Failed to delete profile from native/credentials", "native", {
              profileId: id,
              error: (error as Error).message,
            });
          }
        }

        result.success = result.failureCount === 0;
      }

      logger.info("Bulk delete completed", "storage", {
        total: result.totalCount,
        success: result.successCount,
        failed: result.failureCount,
      });
    } catch (error) {
      result.success = false;
      result.failureCount = ids.length;
      logger.error("Bulk delete failed", "storage", error as Error);
      throw error;
    }

    return result;
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
