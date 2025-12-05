
/**
 * ProfileRepository - SQLite-based profile data access layer
 * 
 * Implements the repository pattern for profile management with:
 * - CRUD operations
 * - Batch operations (bulk create/update/delete)
 * - Query operations (search, filter, etc.)
 * - Tag management
 */

import { ProxyProfile, ProxyType } from "../types";
import {
  IProfileRepository,
  BulkOperationResult,
  BulkOperationError,
  ProfileRow,
  profileToRow,
  rowToProfile,
  FilterOptions,
  QueryOptions,
} from "../types/database";
import { databaseService } from "../services/DatabaseService";
import { logger } from "../services/LoggerService";

export class ProfileRepository implements IProfileRepository {
  /**
   * Create a new profile
   */
  async create(profile: ProxyProfile): Promise<void> {
    try {
      await databaseService.transaction(async (tx) => {
        const row = profileToRow(profile);

        await tx.executeSql(
          `INSERT INTO profiles (id, name, host, port, type, has_auth, dns1, dns2, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            row.name,
            row.host,
            row.port,
            row.type,
            row.has_auth,
            row.dns1,
            row.dns2,
            row.created_at,
            row.updated_at,
          ]
        );

        if (profile.tags && profile.tags.length > 0) {
          for (const tag of profile.tags) {
            await tx.executeSql(
              `INSERT INTO profile_tags (profile_id, tag) VALUES (?, ?)`,
              [profile.id, tag]
            );
          }
        }
      });

      logger.debug("Profile created in database", "database", {
        profileId: profile.id,
        name: profile.name,
      });
    } catch (error) {
      logger.error("Failed to create profile", "database", error as Error, {
        profileId: profile.id,
      });
      throw error;
    }
  }

  /**
   * Get profile by ID
   */
  async getById(id: string): Promise<ProxyProfile | null> {
    try {
      const result = await databaseService.executeSql(
        `SELECT * FROM profiles WHERE id = ?`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as ProfileRow;
      const tags = await this.getTags(id);

      return rowToProfile(row, tags);
    } catch (error) {
      logger.error("Failed to get profile by ID", "database", error as Error, {
        profileId: id,
      });
      throw error;
    }
  }

  /**
   * Get all profiles
   */
  async getAll(): Promise<ProxyProfile[]> {
    try {
      const result = await databaseService.executeSql(
        `SELECT * FROM profiles ORDER BY created_at DESC`
      );

      const profiles: ProxyProfile[] = [];

      for (const row of result.rows) {
        const profileRow = row as ProfileRow;
        const tags = await this.getTags(profileRow.id);
        profiles.push(rowToProfile(profileRow, tags));
      }

      return profiles;
    } catch (error) {
      logger.error("Failed to get all profiles", "database", error as Error);
      throw error;
    }
  }

  /**
   * Update an existing profile
   */
  async update(profile: ProxyProfile): Promise<void> {
    try {
      await databaseService.transaction(async (tx) => {
        const row = profileToRow(profile);

        await tx.executeSql(
          `UPDATE profiles 
           SET name = ?, host = ?, port = ?, type = ?, has_auth = ?, 
               dns1 = ?, dns2 = ?, updated_at = ?
           WHERE id = ?`,
          [
            row.name,
            row.host,
            row.port,
            row.type,
            row.has_auth,
            row.dns1,
            row.dns2,
            row.updated_at,
            row.id,
          ]
        );

        await tx.executeSql(`DELETE FROM profile_tags WHERE profile_id = ?`, [
          profile.id,
        ]);

        if (profile.tags && profile.tags.length > 0) {
          for (const tag of profile.tags) {
            await tx.executeSql(
              `INSERT INTO profile_tags (profile_id, tag) VALUES (?, ?)`,
              [profile.id, tag]
            );
          }
        }
      });

      logger.debug("Profile updated in database", "database", {
        profileId: profile.id,
        name: profile.name,
      });
    } catch (error) {
      logger.error("Failed to update profile", "database", error as Error, {
        profileId: profile.id,
      });
      throw error;
    }
  }

  /**
   * Delete a profile
   */
  async delete(id: string): Promise<void> {
    try {
      await databaseService.executeSql(`DELETE FROM profiles WHERE id = ?`, [
        id,
      ]);

      logger.debug("Profile deleted from database", "database", {
        profileId: id,
      });
    } catch (error) {
      logger.error("Failed to delete profile", "database", error as Error, {
        profileId: id,
      });
      throw error;
    }
  }

  /**
   * Bulk create profiles
   */
  async bulkCreate(profiles: ProxyProfile[]): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: true,
      totalCount: profiles.length,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    try {
      await databaseService.transaction(async (tx) => {
        for (const profile of profiles) {
          try {
            const row = profileToRow(profile);

            await tx.executeSql(
              `INSERT INTO profiles (id, name, host, port, type, has_auth, dns1, dns2, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                row.id,
                row.name,
                row.host,
                row.port,
                row.type,
                row.has_auth,
                row.dns1,
                row.dns2,
                row.created_at,
                row.updated_at,
              ]
            );

            if (profile.tags && profile.tags.length > 0) {
              for (const tag of profile.tags) {
                await tx.executeSql(
                  `INSERT INTO profile_tags (profile_id, tag) VALUES (?, ?)`,
                  [profile.id, tag]
                );
              }
            }

            result.successCount++;
          } catch (error) {
            result.failureCount++;
            result.errors.push({
              id: profile.id,
              error: (error as Error).message,
            });
          }
        }
      });

      result.success = result.failureCount === 0;

      logger.info("Bulk create completed", "database", {
        total: result.totalCount,
        success: result.successCount,
        failed: result.failureCount,
      });
    } catch (error) {
      result.success = false;
      logger.error("Bulk create failed", "database", error as Error);
      throw error;
    }

    return result;
  }

  /**
   * Bulk update profiles
   */
  async bulkUpdate(profiles: ProxyProfile[]): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: true,
      totalCount: profiles.length,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    try {
      await databaseService.transaction(async (tx) => {
        for (const profile of profiles) {
          try {
            const row = profileToRow(profile);

            await tx.executeSql(
              `UPDATE profiles 
               SET name = ?, host = ?, port = ?, type = ?, has_auth = ?, 
                   dns1 = ?, dns2 = ?, updated_at = ?
               WHERE id = ?`,
              [
                row.name,
                row.host,
                row.port,
                row.type,
                row.has_auth,
                row.dns1,
                row.dns2,
                row.updated_at,
                row.id,
              ]
            );

            await tx.executeSql(
              `DELETE FROM profile_tags WHERE profile_id = ?`,
              [profile.id]
            );

            if (profile.tags && profile.tags.length > 0) {
              for (const tag of profile.tags) {
                await tx.executeSql(
                  `INSERT INTO profile_tags (profile_id, tag) VALUES (?, ?)`,
                  [profile.id, tag]
                );
              }
            }

            result.successCount++;
          } catch (error) {
            result.failureCount++;
            result.errors.push({
              id: profile.id,
              error: (error as Error).message,
            });
          }
        }
      });

      result.success = result.failureCount === 0;

      logger.info("Bulk update completed", "database", {
        total: result.totalCount,
        success: result.successCount,
        failed: result.failureCount,
      });
    } catch (error) {
      result.success = false;
      logger.error("Bulk update failed", "database", error as Error);
      throw error;
    }

    return result;
  }

  /**
   * Bulk delete profiles
   */
  async bulkDelete(ids: string[]): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: true,
      totalCount: ids.length,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    try {
      await databaseService.transaction(async (tx) => {
        for (const id of ids) {
          try {
            await tx.executeSql(`DELETE FROM profiles WHERE id = ?`, [id]);
            result.successCount++;
          } catch (error) {
            result.failureCount++;
            result.errors.push({
              id,
              error: (error as Error).message,
            });
          }
        }
      });

      result.success = result.failureCount === 0;

      logger.info("Bulk delete completed", "database", {
        total: result.totalCount,
        success: result.successCount,
        failed: result.failureCount,
      });
    } catch (error) {
      result.success = false;
      logger.error("Bulk delete failed", "database", error as Error);
      throw error;
    }

    return result;
  }

  /**
   * Search profiles by name or host
   */
  async search(query: string): Promise<ProxyProfile[]> {
    try {
      const searchPattern = `%${query}%`;
      const result = await databaseService.executeSql(
        `SELECT * FROM profiles 
         WHERE name LIKE ? OR host LIKE ?
         ORDER BY name ASC`,
        [searchPattern, searchPattern]
      );

      const profiles: ProxyProfile[] = [];

      for (const row of result.rows) {
        const profileRow = row as ProfileRow;
        const tags = await this.getTags(profileRow.id);
        profiles.push(rowToProfile(profileRow, tags));
      }

      return profiles;
    } catch (error) {
      logger.error("Failed to search profiles", "database", error as Error, {
        query,
      });
      throw error;
    }
  }

  /**
   * Filter profiles by tags
   */
  async filterByTags(tags: string[]): Promise<ProxyProfile[]> {
    try {
      if (tags.length === 0) {
        return [];
      }

      const placeholders = tags.map(() => "?").join(",");
      const result = await databaseService.executeSql(
        `SELECT DISTINCT p.* FROM profiles p
         INNER JOIN profile_tags pt ON p.id = pt.profile_id
         WHERE pt.tag IN (${placeholders})
         ORDER BY p.name ASC`,
        tags
      );

      const profiles: ProxyProfile[] = [];

      for (const row of result.rows) {
        const profileRow = row as ProfileRow;
        const profileTags = await this.getTags(profileRow.id);
        profiles.push(rowToProfile(profileRow, profileTags));
      }

      return profiles;
    } catch (error) {
      logger.error("Failed to filter by tags", "database", error as Error, {
        tags,
      });
      throw error;
    }
  }

  /**
   * Get profiles by type
   */
  async getByType(type: ProxyType): Promise<ProxyProfile[]> {
    try {
      const result = await databaseService.executeSql(
        `SELECT * FROM profiles WHERE type = ? ORDER BY name ASC`,
        [type]
      );

      const profiles: ProxyProfile[] = [];

      for (const row of result.rows) {
        const profileRow = row as ProfileRow;
        const tags = await this.getTags(profileRow.id);
        profiles.push(rowToProfile(profileRow, tags));
      }

      return profiles;
    } catch (error) {
      logger.error("Failed to get profiles by type", "database", error as Error, {
        type,
      });
      throw error;
    }
  }

  /**
   * Count total profiles
   */
  async count(): Promise<number> {
    try {
      const result = await databaseService.executeSql(
        `SELECT COUNT(*) as count FROM profiles`
      );

      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error("Failed to count profiles", "database", error as Error);
      throw error;
    }
  }

  /**
   * Add a tag to a profile
   */
  async addTag(profileId: string, tag: string): Promise<void> {
    try {
      await databaseService.executeSql(
        `INSERT OR IGNORE INTO profile_tags (profile_id, tag) VALUES (?, ?)`,
        [profileId, tag]
      );

      logger.debug("Tag added to profile", "database", {
        profileId,
        tag,
      });
    } catch (error) {
      logger.error("Failed to add tag", "database", error as Error, {
        profileId,
        tag,
      });
      throw error;
    }
  }

  /**
   * Remove a tag from a profile
   */
  async removeTag(profileId: string, tag: string): Promise<void> {
    try {
      await databaseService.executeSql(
        `DELETE FROM profile_tags WHERE profile_id = ? AND tag = ?`,
        [profileId, tag]
      );

      logger.debug("Tag removed from profile", "database", {
        profileId,
        tag,
      });
    } catch (error) {
      logger.error("Failed to remove tag", "database", error as Error, {
        profileId,
        tag,
      });
      throw error;
    }
  }

  /**
   * Get all tags for a profile
   */
  async getTags(profileId: string): Promise<string[]> {
    try {
      const result = await databaseService.executeSql(
        `SELECT tag FROM profile_tags WHERE profile_id = ? ORDER BY tag ASC`,
        [profileId]
      );

      return result.rows.map((row: any) => row.tag);
    } catch (error) {
      logger.error("Failed to get tags", "database", error as Error, {
        profileId,
      });
      throw error;
    }
  }

  /**
   * Get all unique tags across all profiles
   */
  async getAllTags(): Promise<string[]> {
    try {
      const result = await databaseService.executeSql(
        `SELECT DISTINCT tag FROM profile_tags ORDER BY tag ASC`
      );

      return result.rows.map((row: any) => row.tag);
    } catch (error) {
      logger.error("Failed to get all tags", "database", error as Error);
      throw error;
    }
  }
}

export const profileRepository = new ProfileRepository();