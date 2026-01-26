/**
 * LoggerService - Core logging service with singleton pattern
 *
 * Features:
 * - Thread-safe singleton implementation
 * - Multi-level logging (debug, info, warn, error, critical)
 * - In-memory circular buffer (max 1000 entries)
 * - Auto-capture metadata (timestamp, category, context)
 * - Console and storage handler integration
 */

import { v4 as uuidv4 } from "uuid";

import type {
  LogLevel,
  LogCategory,
  LogEntry,
  LoggerConfig,
  LogHandler,
  VPNStatus,
} from "../types/logging";

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  enabled: true,
  // Removed "debug" and "info" to reduce noise for user and terminal
  levels: ["warn", "error", "critical"],
  maxEntries: 100, // Reduced from 200 to minimize memory usage
  maxStorageEntries: 500, // Reduced from 1000 to prevent lag
  persistLogs: true,
  consoleOutput: __DEV__, // Only in development
};

/**
 * LoggerService - Singleton logging service
 */
class LoggerService {
  private static instance: LoggerService | null = null;
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private handlers: LogHandler[] = [];

  /**
   * Private constructor for singleton pattern
   */
  private constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeConsoleHandler();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<LoggerConfig>): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService(config);
    }
    return LoggerService.instance;
  }

  /**
   * Initialize console handler for development
   */
  private initializeConsoleHandler(): void {
    if (this.config.consoleOutput) {
      this.addHandler({
        name: "console",
        enabled: true,
        handle: (entry: LogEntry) => {
          const timestamp = new Date(entry.timestamp).toISOString();
          const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${
            entry.category
          }]`;

          switch (entry.level) {
            case "debug":
              console.debug(prefix, entry.message, entry.data || "");
              break;
            case "info":
              console.info(prefix, entry.message, entry.data || "");
              break;
            case "warn":
              console.warn(prefix, entry.message, entry.data || "");
              break;
            case "error":
            case "critical":
              console.error(prefix, entry.message, entry.data || "");
              if (entry.stackTrace) {
                console.error("Stack trace:", entry.stackTrace);
              }
              break;
          }
        },
      });
    }
  }

  /**
   * Add a log handler
   */
  public addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove a log handler by name
   */
  public removeHandler(name: string): void {
    this.handlers = this.handlers.filter((h) => h.name !== name);
  }

  /**
   * Create a log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    category: LogCategory,
    data?: any,
    error?: Error,
    vpnStatus?: VPNStatus,
    profileId?: string,
  ): LogEntry {
    const id = uuidv4();

    const entry: LogEntry = {
      id,
      timestamp: Date.now(),
      level,
      category,
      message,
    };

    if (data) {
      entry.data = data;
    }

    if (error) {
      entry.stackTrace = error.stack;
      if (!entry.data) {
        entry.data = {};
      }
      entry.data.errorName = error.name;
      entry.data.errorMessage = error.message;
    }

    if (vpnStatus) {
      entry.vpnStatus = vpnStatus;
    }

    if (profileId) {
      entry.profileId = profileId;
    }

    return entry;
  }

  /**
   * Add log entry to buffer (circular buffer with FIFO)
   */
  private addToBuffer(entry: LogEntry): void {
    this.buffer.push(entry);

    // Maintain max entries limit (FIFO)
    if (this.buffer.length > this.config.maxEntries) {
      this.buffer.shift();
    }
  }

  /**
   * Process log entry through all handlers
   */
  private async processLog(entry: LogEntry): Promise<void> {
    // Add to in-memory buffer
    this.addToBuffer(entry);

    // Process through all enabled handlers
    const handlerPromises = this.handlers
      .filter((h) => h.enabled)
      .map((h) => {
        try {
          // Skip console handler for filtered levels if console output is reduced
          if (
            h.name === "console" &&
            !this.config.levels.includes(entry.level)
          ) {
            return Promise.resolve();
          }
          return h.handle(entry);
        } catch (error) {
          console.error(`Handler ${h.name} failed:`, error);
          return Promise.resolve();
        }
      });

    await Promise.all(handlerPromises);
  }

  /**
   * Log a debug message
   * @param message Human-readable message
   * @param category Log category
   * @param data Additional structured data
   */
  public debug(message: string, category: LogCategory, data?: any): void {
    if (!this.config.enabled || !this.config.levels.includes("debug")) {
      return;
    }

    const entry = this.createLogEntry("debug", message, category, data);
    this.processLog(entry);
  }

  /**
   * Log an info message
   * @param message Human-readable message
   * @param category Log category
   * @param data Additional structured data
   */
  public info(message: string, category: LogCategory, data?: any): void {
    if (!this.config.enabled || !this.config.levels.includes("info")) {
      return;
    }

    const entry = this.createLogEntry("info", message, category, data);
    this.processLog(entry);
  }

  /**
   * Log a warning message
   * @param message Human-readable message
   * @param category Log category
   * @param data Additional structured data
   */
  public warn(message: string, category: LogCategory, data?: any): void {
    if (!this.config.enabled || !this.config.levels.includes("warn")) {
      return;
    }

    const entry = this.createLogEntry("warn", message, category, data);
    this.processLog(entry);
  }

  /**
   * Log an error message
   * @param message Human-readable message
   * @param category Log category
   * @param error Error object
   * @param data Additional structured data
   */
  public error(
    message: string,
    category: LogCategory,
    error?: Error,
    data?: any,
  ): void {
    if (!this.config.enabled || !this.config.levels.includes("error")) {
      return;
    }

    const entry = this.createLogEntry("error", message, category, data, error);
    this.processLog(entry);
  }

  /**
   * Log a critical error message
   * @param message Human-readable message
   * @param category Log category
   * @param error Error object
   * @param data Additional structured data
   */
  public critical(
    message: string,
    category: LogCategory,
    error?: Error,
    data?: any,
  ): void {
    if (!this.config.enabled || !this.config.levels.includes("critical")) {
      return;
    }

    const entry = this.createLogEntry(
      "critical",
      message,
      category,
      data,
      error,
    );
    this.processLog(entry);
  }

  /**
   * Get all logs from buffer
   */
  public getLogs(): LogEntry[] {
    return [...this.buffer];
  }

  /**
   * Get buffer size
   */
  public getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Clear the log buffer
   */
  public clearBuffer(): void {
    this.buffer = [];
  }

  /**
   * Clear logs (alias for clearBuffer for consistency)
   */
  public clearLogs(): void {
    this.clearBuffer();
  }

  /**
   * Update logger configuration
   * @param config Partial configuration to update
   */
  public updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Check if logger is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable logger
   */
  public enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable logger
   */
  public disable(): void {
    this.config.enabled = false;
  }
}

// Export singleton instance
export const logger = LoggerService.getInstance();
export default LoggerService;
