/**
 * NativeSyncService - Synchronizes profiles with native VPN module
 * 
 * Manages the sync_log table to track synchronization operations
 * and ensures profiles are properly synced to the native module
 * with retry logic for failed operations.
 */

import { ProxyProfile } from "../types";
import {
  SyncOperation,
  SyncQueueStats,
  SyncResult,
  SyncError,
  SyncLogRow,
  rowToSyncOperation,
} from "../types/database";
import { databaseService } from "./DatabaseService";
import { VPNModule } from "../native/VPNModule";
import { logger } from "./LoggerService";

const MAX_RETRY_COUNT = 3;
const SYNC_BATCH_SIZE = 10;

export class NativeSyncService {
  /**
   * Queue a sync operation
   */
  async queueSync(
    profileId: string,
    operation: "create" | "update" | "delete"
  ): Promise<void> {
    try {
      await databaseService.executeSql(
        `INSERT INTO sync_log (profile_id, operation, status, retry_count, created_at, updated_at)
         VALUES (?, ?, 'pending', 0, ?, ?)`,
        [profileId, operation, new Date().toISOString(), new Date().toISOString()]
      );

      logger.debug("Sync operation queued", "database", {
        profileId,
        operation,
      });
    } catch (error) {
      logger.error("Failed to queue sync operation", "database", error as Error, {
        profileId,
        operation,
      });
      throw error;
    }
  }

  /**
   * Process pending sync operations
   */
  async processSyncQueue(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      processedCount: 0,
      failedCount: 0,
      errors: [],
    };

    try {
      const pendingOps = await this.getPendingOperations(SYNC_BATCH_SIZE);

      for (const op of pendingOps) {
        try {
          await this.executeSyncOperation(op);
          await this.markSyncSuccess(op.id);
          result.processedCount++;
        } catch (error) {
          result.failedCount++;
          const errorMsg = (error as Error).message;
          
          result.errors.push({
            profileId: op.profileId,
            operation: op.operation,
            error: errorMsg,
            retryCount: op.retryCount,
          });

          if (op.retryCount < MAX_RETRY_COUNT) {
            await this.markSyncFailed(op.id, errorMsg);
          } else {
            logger.error("Sync operation exceeded max retries", "database", error as Error, {
              profileId: op.profileId,
              operation: op.operation,
              retryCount: op.retryCount,
            });
          }
        }
      }

      result.success = result.failedCount === 0;

      if (result.processedCount > 0) {
        logger.info("Sync queue processed", "database", {
          processed: result.processedCount,
          failed: result.failedCount,
        });
      }
    } catch (error) {
      result.success = false;
      logger.error("Failed to process sync queue", "database", error as Error);
    }

    return result;
  }

  /**
   * Execute a single sync operation
   */
  private async executeSyncOperation(op: SyncOperation): Promise<void> {
    try {
      switch (op.operation) {
        case "create":
        case "update":
          await this.syncProfileToNative(op.profileId);
          break;
        case "delete":
          await VPNModule.deleteProfile(op.profileId);
          logger.debug("Profile deleted from native", "native", {
            profileId: op.profileId,
          });
          break;
      }
    } catch (error) {
      logger.error("Sync operation failed", "native", error as Error, {
        profileId: op.profileId,
        operation: op.operation,
      });
      throw error;
    }
  }

  /**
   * Sync a profile to native module
   */
  private async syncProfileToNative(profileId: string): Promise<void> {
    const result = await databaseService.executeSql(
      `SELECT * FROM profiles WHERE id = ?`,
      [profileId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const row = result.rows[0];

    await VPNModule.saveProfile(
      row.name,
      row.host,
      row.port,
      row.type,
      "",
      ""
    );

    logger.debug("Profile synced to native", "native", {
      profileId,
      name: row.name,
    });
  }

  /**
   * Get pending sync operations
   */
  private async getPendingOperations(limit: number): Promise<SyncOperation[]> {
    const result = await databaseService.executeSql(
      `SELECT * FROM sync_log 
       WHERE status = 'pending' AND retry_count < ?
       ORDER BY created_at ASC
       LIMIT ?`,
      [MAX_RETRY_COUNT, limit]
    );

    return result.rows.map((row) => rowToSyncOperation(row as SyncLogRow));
  }

  /**
   * Mark sync operation as successful
   */
  private async markSyncSuccess(syncId: number): Promise<void> {
    await databaseService.executeSql(
      `UPDATE sync_log 
       SET status = 'success', updated_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), syncId]
    );
  }

  /**
   * Mark sync operation as failed and increment retry count
   */
  private async markSyncFailed(syncId: number, errorMessage: string): Promise<void> {
    await databaseService.executeSql(
      `UPDATE sync_log 
       SET status = 'failed', error_message = ?, retry_count = retry_count + 1, updated_at = ?
       WHERE id = ?`,
      [errorMessage, new Date().toISOString(), syncId]
    );
  }

  /**
   * Get sync queue statistics
   */
  async getQueueStats(): Promise<SyncQueueStats> {
    try {
      const result = await databaseService.executeSql(
        `SELECT 
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
           SUM(retry_count) as total_retries
         FROM sync_log`
      );

      const row = result.rows[0];

      return {
        pendingCount: row?.pending_count || 0,
        failedCount: row?.failed_count || 0,
        totalRetries: row?.total_retries || 0,
      };
    } catch (error) {
      logger.error("Failed to get queue stats", "database", error as Error);
      throw error;
    }
  }

  /**
   * Clear completed sync operations
   */
  async clearCompletedOperations(olderThanDays: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await databaseService.executeSql(
        `DELETE FROM sync_log 
         WHERE status = 'success' AND updated_at < ?`,
        [cutoffDate.toISOString()]
      );

      logger.info("Cleared completed sync operations", "database", {
        count: result.rowsAffected,
        olderThanDays,
      });

      return result.rowsAffected;
    } catch (error) {
      logger.error("Failed to clear completed operations", "database", error as Error);
      throw error;
    }
  }

  /**
   * Retry all failed operations
   */
  async retryFailedOperations(): Promise<SyncResult> {
    try {
      await databaseService.executeSql(
        `UPDATE sync_log 
         SET status = 'pending', retry_count = 0, error_message = NULL, updated_at = ?
         WHERE status = 'failed'`,
        [new Date().toISOString()]
      );

      logger.info("Reset failed operations for retry", "database");

      return await this.processSyncQueue();
    } catch (error) {
      logger.error("Failed to retry operations", "database", error as Error);
      throw error;
    }
  }

  /**
   * Sync a specific profile immediately (bypass queue)
   */
  async syncProfileImmediate(profile: ProxyProfile): Promise<void> {
    try {
      await VPNModule.saveProfile(
        profile.name,
        profile.host,
        profile.port,
        profile.type,
        profile.username || "",
        profile.password || ""
      );

      logger.debug("Profile synced immediately to native", "native", {
        profileId: profile.id,
        name: profile.name,
      });
    } catch (error) {
      logger.error("Immediate sync failed", "native", error as Error, {
        profileId: profile.id,
      });
      throw error;
    }
  }
}

export const nativeSyncService = new NativeSyncService();