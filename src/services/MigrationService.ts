/**
 * MigrationService - Migrates data from AsyncStorage to SQLite
 * 
 * Handles the one-time migration of existing profile data from
 * AsyncStorage to the new SQLite database with validation and
 * rollback capabilities.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { ProxyProfile, StoredProfile, StoredCredentials } from "../types";
import { MigrationResult, MigrationProgress } from "../types/database";
import { databaseService } from "./DatabaseService";
import { profileRepository } from "../repositories/ProfileRepository";
import { logger } from "./LoggerService";

const PROFILES_KEY = "@cbv_vpn_profiles";
const CREDENTIALS_PREFIX = "cbv_vpn_creds_";
const MIGRATION_FLAG_KEY = "@cbv_vpn_migration_completed";

export class MigrationService {
  private progressCallback?: (progress: MigrationProgress) => void;

  /**
   * Set progress callback for UI updates
   */
  setProgressCallback(callback: (progress: MigrationProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Check if migration has been completed
   */
  async isMigrationCompleted(): Promise<boolean> {
    try {
      const flag = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
      return flag === "true";
    } catch (error) {
      logger.error("Failed to check migration status", "database", error as Error);
      return false;
    }
  }

  /**
   * Mark migration as completed
   */
  private async markMigrationCompleted(): Promise<void> {
    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, "true");
  }

  /**
   * Perform migration from AsyncStorage to SQLite
   */
  async migrate(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      migratedCount: 0,
      failedCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      logger.info("Starting migration from AsyncStorage to SQLite", "database");

      const isCompleted = await this.isMigrationCompleted();
      if (isCompleted) {
        logger.info("Migration already completed, skipping", "database");
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      await databaseService.initialize();

      const profiles = await this.loadProfilesFromAsyncStorage();
      
      if (profiles.length === 0) {
        logger.info("No profiles to migrate", "database");
        await this.markMigrationCompleted();
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      logger.info(`Found ${profiles.length} profiles to migrate`, "database");

      for (let i = 0; i < profiles.length; i++) {
        const profile = profiles[i];
        
        this.reportProgress({
          total: profiles.length,
          current: i + 1,
          percentage: Math.round(((i + 1) / profiles.length) * 100),
          currentProfile: profile.name,
        });

        try {
          await profileRepository.create(profile);
          result.migratedCount++;
          
          logger.debug("Profile migrated successfully", "database", {
            profileId: profile.id,
            name: profile.name,
          });
        } catch (error) {
          result.failedCount++;
          const errorMsg = (error as Error).message;
          result.errors.push(`Failed to migrate profile ${profile.name}: ${errorMsg}`);
          
          logger.error("Failed to migrate profile", "database", error as Error, {
            profileId: profile.id,
            name: profile.name,
          });
        }
      }

      const validationResult = await this.validateMigration(profiles.length);
      
      if (validationResult) {
        await this.markMigrationCompleted();
        result.success = true;
        logger.info("Migration completed successfully", "database", {
          migrated: result.migratedCount,
          failed: result.failedCount,
        });
      } else {
        result.success = false;
        result.errors.push("Migration validation failed");
        logger.error("Migration validation failed", "database");
      }
    } catch (error) {
      result.success = false;
      const errorMsg = (error as Error).message;
      result.errors.push(`Migration failed: ${errorMsg}`);
      logger.error("Migration failed", "database", error as Error);
      
      await this.rollback();
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Load profiles from AsyncStorage
   */
  private async loadProfilesFromAsyncStorage(): Promise<ProxyProfile[]> {
    try {
      const storedData = await AsyncStorage.getItem(PROFILES_KEY);
      
      if (!storedData) {
        return [];
      }

      const storedProfiles: StoredProfile[] = JSON.parse(storedData);
      const profiles: ProxyProfile[] = [];

      for (const stored of storedProfiles) {
        let username: string | undefined;
        let password: string | undefined;

        if (stored.hasAuth) {
          const credentials = await this.getCredentials(stored.id);
          if (credentials) {
            username = credentials.username;
            password = credentials.password;
          }
        }

        profiles.push({
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
        });
      }

      return profiles;
    } catch (error) {
      logger.error("Failed to load profiles from AsyncStorage", "storage", error as Error);
      throw error;
    }
  }

  /**
   * Get credentials from SecureStore
   */
  private async getCredentials(profileId: string): Promise<StoredCredentials | null> {
    try {
      const sanitizedId = this.sanitizeKey(profileId);
      const key = `${CREDENTIALS_PREFIX}${sanitizedId}`;
      const credentialsData = await SecureStore.getItemAsync(key);

      if (!credentialsData) {
        return null;
      }

      return JSON.parse(credentialsData);
    } catch (error) {
      logger.warn("Failed to get credentials", "storage", {
        profileId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Sanitize key for SecureStore
   */
  private sanitizeKey(key: string): string {
    if (!key || key.trim() === "") {
      throw new Error("Profile ID cannot be empty");
    }
    return key.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  /**
   * Validate migration by comparing counts
   */
  private async validateMigration(expectedCount: number): Promise<boolean> {
    try {
      const actualCount = await profileRepository.count();
      const isValid = actualCount >= expectedCount;

      if (!isValid) {
        logger.error("Migration validation failed", "database", undefined, {
          expected: expectedCount,
          actual: actualCount,
        });
      }

      return isValid;
    } catch (error) {
      logger.error("Failed to validate migration", "database", error as Error);
      return false;
    }
  }

  /**
   * Rollback migration by clearing SQLite data
   */
  private async rollback(): Promise<void> {
    try {
      logger.warn("Rolling back migration", "database");
      
      await databaseService.executeSql(`DELETE FROM profile_tags`);
      await databaseService.executeSql(`DELETE FROM profiles`);
      await databaseService.executeSql(`DELETE FROM sync_log`);
      
      logger.info("Migration rolled back successfully", "database");
    } catch (error) {
      logger.error("Failed to rollback migration", "database", error as Error);
    }
  }

  /**
   * Report migration progress
   */
  private reportProgress(progress: MigrationProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * Force re-migration (for testing or recovery)
   */
  async forceMigration(): Promise<MigrationResult> {
    try {
      await AsyncStorage.removeItem(MIGRATION_FLAG_KEY);
      await this.rollback();
      return await this.migrate();
    } catch (error) {
      logger.error("Force migration failed", "database", error as Error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    completed: boolean;
    asyncStorageCount: number;
    sqliteCount: number;
  }> {
    try {
      const completed = await this.isMigrationCompleted();
      
      let asyncStorageCount = 0;
      try {
        const storedData = await AsyncStorage.getItem(PROFILES_KEY);
        if (storedData) {
          const profiles: StoredProfile[] = JSON.parse(storedData);
          asyncStorageCount = profiles.length;
        }
      } catch (error) {
        logger.warn("Failed to get AsyncStorage count", "storage");
      }

      let sqliteCount = 0;
      try {
        if (databaseService.isInitialized()) {
          sqliteCount = await profileRepository.count();
        }
      } catch (error) {
        logger.warn("Failed to get SQLite count", "database");
      }

      return {
        completed,
        asyncStorageCount,
        sqliteCount,
      };
    } catch (error) {
      logger.error("Failed to get migration status", "database", error as Error);
      throw error;
    }
  }
}

export const migrationService = new MigrationService();