/**
 * Logging System Type Definitions
 *
 * Comprehensive type definitions for the CB-Pro-Proxy logging system.
 * Supports multi-level logging with categorization, filtering, and persistence.
 */

/**
 * Log severity levels
 */
export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

/**
 * Log source categories for better organization
 */
export type LogCategory =
  | "app" // App lifecycle events
  | "vpn" // VPN connection events
  | "network" // Network operations
  | "storage" // Storage operations
  | "database" // Database operations
  | "ui" // UI interactions
  | "native" // Native module events
  | "proxySource" // Proxy source operations
  | "error"; // Error events

/**
 * VPN status types (from existing VPN module)
 */
export type VPNStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "handshaking"
  | "disconnecting"
  | "error";

/**
 * Core log entry structure
 */
export interface LogEntry {
  /** Unique identifier (UUID) */
  id: string;

  /** Unix timestamp in milliseconds */
  timestamp: number;

  /** Log severity level */
  level: LogLevel;

  /** Log source category */
  category: LogCategory;

  /** Human-readable message */
  message: string;

  /** Additional structured data */
  data?: Record<string, any>;

  /** Error stack trace (for errors) */
  stackTrace?: string;

  /** Associated VPN status */
  vpnStatus?: VPNStatus;

  /** Associated profile ID */
  profileId?: string;
}

/**
 * Filter criteria for log queries
 */
export interface LogFilter {
  /** Filter by log levels */
  levels?: LogLevel[];

  /** Filter by categories */
  categories?: LogCategory[];

  /** Search text in messages */
  search?: string;

  /** Filter logs after this timestamp */
  startTime?: number;

  /** Filter logs before this timestamp */
  endTime?: number;

  /** Filter by profile ID */
  profileId?: string;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Master enable/disable */
  enabled: boolean;

  /** Enabled log levels */
  levels: LogLevel[];

  /** Max in-memory entries (default: 1000) */
  maxEntries: number;

  /** Max persisted entries (default: 5000) */
  maxStorageEntries: number;

  /** Enable persistence */
  persistLogs: boolean;

  /** Output to console */
  consoleOutput: boolean;

  /** Optional remote logging */
  remoteLogging?: {
    enabled: boolean;
    endpoint: string;
    apiKey?: string;
  };
}

/**
 * Log statistics
 */
export interface LogStatistics {
  /** Total number of logs */
  total: number;

  /** Count by log level */
  byLevel: Record<LogLevel, number>;

  /** Count by category */
  byCategory: Record<LogCategory, number>;

  /** Error rate (errors / total) */
  errorRate: number;

  /** Time range of logs */
  timeRange?: {
    oldest: number;
    newest: number;
  };
}

/**
 * Log partition metadata for storage organization
 */
export interface LogPartition {
  /** Partition ID (YYYY-MM-DD format) */
  id: string;

  /** Start timestamp of partition */
  startTime: number;

  /** End timestamp of partition */
  endTime: number;

  /** Number of logs in partition */
  count: number;

  /** Approximate size in bytes */
  size: number;
}

/**
 * Log partition index for managing storage
 */
export interface LogPartitionIndex {
  /** List of all partitions */
  partitions: LogPartition[];

  /** Last update timestamp */
  lastUpdated: number;
}

/**
 * Export format options
 */
export type ExportFormat = "json" | "csv" | "txt";

/**
 * Log handler interface for extensibility
 */
export interface LogHandler {
  /** Handle a log entry */
  handle(entry: LogEntry): void | Promise<void>;

  /** Handler name */
  name: string;

  /** Handler enabled state */
  enabled: boolean;
}
