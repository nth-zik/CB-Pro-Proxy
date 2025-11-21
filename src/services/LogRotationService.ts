/**
 * LogRotationService - Log persistence and rotation service
 *
 * Features:
 * - AsyncStorage integration for log persistence
 * - Partition-based storage (by date)
 * - Automatic rotation when size exceeds 5MB
 * - 30-day retention policy
 * - Efficient log loading and cleanup
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  LogEntry,
  LogPartition,
  LogPartitionIndex,
} from "../types/logging";

/**
 * Storage keys for AsyncStorage
 */
const STORAGE_KEYS = {
  LOGS_CONFIG: "@cbv_vpn_logs_config",
  LOGS_INDEX: "@cbv_vpn_logs_index",
  LOGS_PARTITION: "@cbv_vpn_logs_",
} as const;

/**
 * Storage limits
 */
const STORAGE_LIMITS = {
  MAX_PARTITION_SIZE: 5 * 1024 * 1024, // 5MB per partition
  MAX_TOTAL_SIZE: 50 * 1024 * 1024, // 50MB total
  RETENTION_DAYS: 30,
  SQLITE_ROW_SOFT_LIMIT: 900 * 1024, // ~900KB to stay under CursorWindow row limit
} as const;

/**
 * LogRotationService - Manages log persistence and rotation
 */
class LogRotationService {
  private static instance: LogRotationService | null = null;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): LogRotationService {
    if (!LogRotationService.instance) {
      LogRotationService.instance = new LogRotationService();
    }
    return LogRotationService.instance;
  }

  /**
   * Get partition ID from timestamp (YYYY-MM-DD format)
   */
  private getPartitionId(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Get partition key for AsyncStorage
   */
  private getPartitionKey(partitionId: string): string {
    return `${STORAGE_KEYS.LOGS_PARTITION}${partitionId}`;
  }

  /**
   * Load partition index from storage
   */
  private async loadPartitionIndex(): Promise<LogPartitionIndex> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LOGS_INDEX);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Failed to load partition index:", error);
    }

    return {
      partitions: [],
      lastUpdated: Date.now(),
    };
  }

  /**
   * Save partition index to storage
   */
  private async savePartitionIndex(index: LogPartitionIndex): Promise<void> {
    try {
      index.lastUpdated = Date.now();
      await AsyncStorage.setItem(
        STORAGE_KEYS.LOGS_INDEX,
        JSON.stringify(index)
      );
    } catch (error) {
      console.error("Failed to save partition index:", error);
      throw error;
    }
  }

  /**
   * Get partition from index by ID
   */
  private getPartition(
    index: LogPartitionIndex,
    partitionId: string
  ): LogPartition | undefined {
    return index.partitions.find((p) => p.id === partitionId);
  }

  /**
   * Estimate size of log entries in bytes
   */
  private estimateSize(logs: LogEntry[]): number {
    return JSON.stringify(logs).length;
  }

  /**
   * Save logs to a partition
   * @param logs Array of log entries to save
   */
  public async saveLogs(logs: LogEntry[]): Promise<void> {
    if (logs.length === 0) {
      return;
    }

    try {
      // Group logs by partition (date)
      const partitionGroups = new Map<string, LogEntry[]>();

      for (const log of logs) {
        const partitionId = this.getPartitionId(log.timestamp);
        const group = partitionGroups.get(partitionId) || [];
        group.push(log);
        partitionGroups.set(partitionId, group);
      }

      // Load current index
      const index = await this.loadPartitionIndex();

      // Save each partition group
      for (const [partitionId, partitionLogs] of partitionGroups) {
        await this.savePartition(index, partitionId, partitionLogs);
      }

      // Save updated index
      await this.savePartitionIndex(index);

      // Check if rotation is needed
      await this.rotateIfNeeded(index);
    } catch (error) {
      console.error("Failed to save logs:", error);
      throw error;
    }
  }

  /**
   * Save logs to a specific partition
   */
  private async savePartition(
    index: LogPartitionIndex,
    partitionId: string,
    newLogs: LogEntry[]
  ): Promise<void> {
    const partitionKey = this.getPartitionKey(partitionId);

    try {
      // Load existing logs from partition
      let existingLogs: LogEntry[] = [];
      const existingData = await AsyncStorage.getItem(partitionKey);
      if (existingData) {
        existingLogs = JSON.parse(existingData);
      }

      // Merge and sort by timestamp
      let allLogs = [...existingLogs, ...newLogs].sort(
        (a, b) => a.timestamp - b.timestamp
      );

      // Trim if payload is too large for SQLite CursorWindow
      let size = this.estimateSize(allLogs);
      if (size > STORAGE_LIMITS.SQLITE_ROW_SOFT_LIMIT) {
        const originalCount = allLogs.length;
        // Drop oldest logs until under soft limit
        while (allLogs.length > 0 && size > STORAGE_LIMITS.SQLITE_ROW_SOFT_LIMIT) {
          allLogs.shift();
          size = this.estimateSize(allLogs);
        }
        console.warn(
          `[LogRotationService] Trimmed ${originalCount - allLogs.length} logs from partition ${partitionId} to fit row limit`
        );
      }

      // Calculate partition metadata
      const timestamps = allLogs.map((l) => l.timestamp);
      const startTime = timestamps.length ? Math.min(...timestamps) : Date.now();
      const endTime = timestamps.length ? Math.max(...timestamps) : Date.now();

      // Save partition
      await AsyncStorage.setItem(partitionKey, JSON.stringify(allLogs));

      // Update partition in index
      const existingPartition = this.getPartition(index, partitionId);
      if (existingPartition) {
        existingPartition.count = allLogs.length;
        existingPartition.size = size;
        existingPartition.startTime = startTime;
        existingPartition.endTime = endTime;
      } else {
        index.partitions.push({
          id: partitionId,
          startTime,
          endTime,
          count: allLogs.length,
          size,
        });
      }
    } catch (error) {
      console.error(`Failed to save partition ${partitionId}:`, error);
      throw error;
    }
  }

  /**
   * Load logs from storage
   * @param startTime Optional start time filter
   * @param endTime Optional end time filter
   */
  public async loadLogs(
    startTime?: number,
    endTime?: number
  ): Promise<LogEntry[]> {
    try {
      const index = await this.loadPartitionIndex();
      const allLogs: LogEntry[] = [];

      // Load logs from relevant partitions
      for (const partition of index.partitions) {
        // Skip partitions outside time range
        if (startTime && partition.endTime < startTime) continue;
        if (endTime && partition.startTime > endTime) continue;

        const partitionKey = this.getPartitionKey(partition.id);
        const data = await AsyncStorage.getItem(partitionKey);

        if (data) {
          const logs: LogEntry[] = JSON.parse(data);
          allLogs.push(...logs);
        }
      }

      // Filter by time range if specified
      let filteredLogs = allLogs;
      if (startTime || endTime) {
        filteredLogs = allLogs.filter((log) => {
          if (startTime && log.timestamp < startTime) return false;
          if (endTime && log.timestamp > endTime) return false;
          return true;
        });
      }

      // Sort by timestamp (newest first)
      return filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error("Failed to load logs:", error);
      return [];
    }
  }

  /**
   * Rotate logs if needed (check size limits)
   */
  private async rotateIfNeeded(index: LogPartitionIndex): Promise<void> {
    try {
      const totalSize = index.partitions.reduce((sum, p) => sum + p.size, 0);

      // If total size exceeds limit, remove oldest partitions
      if (totalSize > STORAGE_LIMITS.MAX_TOTAL_SIZE) {
        const sorted = [...index.partitions].sort(
          (a, b) => a.startTime - b.startTime
        );

        // Remove oldest 25% of partitions
        const toRemove = Math.ceil(sorted.length * 0.25);
        for (let i = 0; i < toRemove; i++) {
          await this.removePartition(index, sorted[i].id);
        }

        await this.savePartitionIndex(index);
      }
    } catch (error) {
      console.error("Failed to rotate logs:", error);
    }
  }

  /**
   * Remove a partition
   */
  private async removePartition(
    index: LogPartitionIndex,
    partitionId: string
  ): Promise<void> {
    try {
      const partitionKey = this.getPartitionKey(partitionId);
      await AsyncStorage.removeItem(partitionKey);

      index.partitions = index.partitions.filter((p) => p.id !== partitionId);
    } catch (error) {
      console.error(`Failed to remove partition ${partitionId}:`, error);
    }
  }

  /**
   * Clean up old logs (older than retention period)
   */
  public async cleanupOldLogs(): Promise<void> {
    try {
      const cutoffTime =
        Date.now() - STORAGE_LIMITS.RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const index = await this.loadPartitionIndex();

      const oldPartitions = index.partitions.filter(
        (p) => p.endTime < cutoffTime
      );

      for (const partition of oldPartitions) {
        await this.removePartition(index, partition.id);
      }

      if (oldPartitions.length > 0) {
        await this.savePartitionIndex(index);
      }
    } catch (error) {
      console.error("Failed to cleanup old logs:", error);
    }
  }

  /**
   * Get partition statistics
   */
  public async getStats(): Promise<{
    totalPartitions: number;
    totalLogs: number;
    totalSize: number;
    oldestLog: number | null;
    newestLog: number | null;
  }> {
    try {
      const index = await this.loadPartitionIndex();

      const totalPartitions = index.partitions.length;
      const totalLogs = index.partitions.reduce((sum, p) => sum + p.count, 0);
      const totalSize = index.partitions.reduce((sum, p) => sum + p.size, 0);

      const timestamps = index.partitions.flatMap((p) => [
        p.startTime,
        p.endTime,
      ]);
      const oldestLog = timestamps.length > 0 ? Math.min(...timestamps) : null;
      const newestLog = timestamps.length > 0 ? Math.max(...timestamps) : null;

      return {
        totalPartitions,
        totalLogs,
        totalSize,
        oldestLog,
        newestLog,
      };
    } catch (error) {
      console.error("Failed to get stats:", error);
      return {
        totalPartitions: 0,
        totalLogs: 0,
        totalSize: 0,
        oldestLog: null,
        newestLog: null,
      };
    }
  }

  /**
   * Clear all logs
   */
  public async clearAllLogs(): Promise<void> {
    try {
      const index = await this.loadPartitionIndex();

      // Remove all partitions
      for (const partition of index.partitions) {
        const partitionKey = this.getPartitionKey(partition.id);
        await AsyncStorage.removeItem(partitionKey);
      }

      // Clear index
      await AsyncStorage.removeItem(STORAGE_KEYS.LOGS_INDEX);
    } catch (error) {
      console.error("Failed to clear all logs:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const logRotationService = LogRotationService.getInstance();
export default LogRotationService;
