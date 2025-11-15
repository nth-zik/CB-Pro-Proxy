/**
 * Logging Store - Zustand state management for logging system
 *
 * Features:
 * - In-memory log storage
 * - Log filtering and search
 * - Integration with LoggerService and LogRotationService
 * - Auto-persist to AsyncStorage
 * - Statistics computation
 */

import { create } from "zustand";
import type {
  LogEntry,
  LogLevel,
  LogCategory,
  LogFilter,
  LogStatistics,
  LoggerConfig,
} from "../types/logging";
import { logger } from "../services/LoggerService";
import { logRotationService } from "../services/LogRotationService";

/**
 * Logging store state interface
 */
interface LoggingStore {
  // State
  logs: LogEntry[];
  config: LoggerConfig;
  filters: LogFilter;
  isLoading: boolean;
  error: string | null;

  // Actions
  addLog: (entry: LogEntry) => void;
  addLogs: (entries: LogEntry[]) => void;
  clearLogs: () => Promise<void>;
  loadPersistedLogs: (startTime?: number, endTime?: number) => Promise<void>;
  setFilters: (filters: LogFilter) => void;
  updateConfig: (config: Partial<LoggerConfig>) => Promise<void>;
  exportLogs: (format: "json" | "csv" | "txt") => string;

  // Computed
  getFilteredLogs: () => LogEntry[];
  getLogStats: () => LogStatistics;

  // Internal
  _setLoading: (loading: boolean) => void;
  _setError: (error: string | null) => void;
}

/**
 * Filter logs based on filter criteria
 */
const filterLogs = (logs: LogEntry[], filters: LogFilter): LogEntry[] => {
  return logs.filter((log) => {
    // Filter by levels
    if (filters.levels && filters.levels.length > 0) {
      if (!filters.levels.includes(log.level)) {
        return false;
      }
    }

    // Filter by categories
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(log.category)) {
        return false;
      }
    }

    // Filter by search text
    if (filters.search && filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      const messageMatch = log.message.toLowerCase().includes(searchLower);
      const dataMatch = log.data
        ? JSON.stringify(log.data).toLowerCase().includes(searchLower)
        : false;

      if (!messageMatch && !dataMatch) {
        return false;
      }
    }

    // Filter by time range
    if (filters.startTime && log.timestamp < filters.startTime) {
      return false;
    }
    if (filters.endTime && log.timestamp > filters.endTime) {
      return false;
    }

    // Filter by profile ID
    if (filters.profileId && log.profileId !== filters.profileId) {
      return false;
    }

    return true;
  });
};

/**
 * Calculate log statistics
 */
const calculateStats = (logs: LogEntry[]): LogStatistics => {
  const total = logs.length;

  // Count by level
  const byLevel: Record<LogLevel, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    critical: 0,
  };

  // Count by category
  const byCategory: Record<LogCategory, number> = {
    app: 0,
    vpn: 0,
    network: 0,
    storage: 0,
    ui: 0,
    native: 0,
    error: 0,
  };

  let errorCount = 0;

  logs.forEach((log) => {
    byLevel[log.level]++;
    byCategory[log.category]++;

    if (log.level === "error" || log.level === "critical") {
      errorCount++;
    }
  });

  const errorRate = total > 0 ? errorCount / total : 0;

  // Time range
  let timeRange: { oldest: number; newest: number } | undefined;
  if (logs.length > 0) {
    const timestamps = logs.map((l) => l.timestamp);
    timeRange = {
      oldest: Math.min(...timestamps),
      newest: Math.max(...timestamps),
    };
  }

  return {
    total,
    byLevel,
    byCategory,
    errorRate,
    timeRange,
  };
};

/**
 * Export logs in different formats
 */
const exportLogsToFormat = (
  logs: LogEntry[],
  format: "json" | "csv" | "txt"
): string => {
  if (format === "json") {
    return JSON.stringify(logs, null, 2);
  }

  if (format === "csv") {
    const headers = "Timestamp,Level,Category,Message,Data,VPNStatus,ProfileId";
    const rows = logs.map((log) => {
      const timestamp = new Date(log.timestamp).toISOString();
      const data = log.data ? JSON.stringify(log.data).replace(/"/g, '""') : "";
      return `"${timestamp}","${log.level}","${
        log.category
      }","${log.message.replace(/"/g, '""')}","${data}","${
        log.vpnStatus || ""
      }","${log.profileId || ""}"`;
    });
    return [headers, ...rows].join("\n");
  }

  // Text format
  return logs
    .map((log) => {
      const timestamp = new Date(log.timestamp).toISOString();
      let text = `[${timestamp}] [${log.level.toUpperCase()}] [${
        log.category
      }] ${log.message}`;

      if (log.data) {
        text += `\n  Data: ${JSON.stringify(log.data, null, 2)}`;
      }

      if (log.vpnStatus) {
        text += `\n  VPN Status: ${log.vpnStatus}`;
      }

      if (log.profileId) {
        text += `\n  Profile ID: ${log.profileId}`;
      }

      if (log.stackTrace) {
        text += `\n  Stack Trace:\n${log.stackTrace}`;
      }

      return text;
    })
    .join("\n\n");
};

/**
 * Create the logging store
 */
export const useLoggingStore = create<LoggingStore>((set, get) => ({
  // Initial state
  logs: [],
  config: logger.getConfig(),
  filters: {},
  isLoading: false,
  error: null,

  // Add a single log entry
  addLog: (entry: LogEntry) => {
    set((state) => {
      // Silently skip duplicates - early return prevents adding them
      const existingEntry = state.logs.find((log) => log.id === entry.id);
      if (existingEntry) {
        return state; // No change if duplicate
      }

      return {
        logs: [...state.logs, entry],
      };
    });
  },

  // Add multiple log entries
  addLogs: (entries: LogEntry[]) => {
    set((state) => {
      // DEBUG: Track duplicates being added
      const existingIds = new Set(state.logs.map((log) => log.id));
      const duplicateCount = entries.filter((entry) =>
        existingIds.has(entry.id)
      ).length;

      if (duplicateCount > 0) {
        console.error(
          `[loggingStore.addLogs] Attempting to add ${duplicateCount} duplicate entries out of ${entries.length} total entries`
        );
        console.error("[loggingStore.addLogs] Stack trace:", new Error().stack);
      }

      // Filter out duplicates before adding
      const newEntries = entries.filter((entry) => !existingIds.has(entry.id));

      if (newEntries.length < entries.length) {
        console.warn(
          `[loggingStore.addLogs] Filtered out ${
            entries.length - newEntries.length
          } duplicate entries`
        );
      }

      return {
        logs: [...state.logs, ...newEntries],
      };
    });
  },

  // Clear all logs (memory and storage)
  clearLogs: async () => {
    get()._setLoading(true);
    get()._setError(null);

    try {
      // Clear from logger buffer
      logger.clearBuffer();

      // Clear from storage
      await logRotationService.clearAllLogs();

      // Clear from store
      set({ logs: [] });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      get()._setError(errorMessage);
      console.error("Failed to clear logs:", error);
    } finally {
      get()._setLoading(false);
    }
  },

  // Load persisted logs from storage
  loadPersistedLogs: async (startTime?: number, endTime?: number) => {
    get()._setLoading(true);
    get()._setError(null);

    try {
      const currentState = get();
      console.log(
        `[loggingStore.loadPersistedLogs] Current in-memory logs: ${currentState.logs.length}`
      );

      const persistedLogs = await logRotationService.loadLogs(
        startTime,
        endTime
      );

      console.log(
        `[loggingStore.loadPersistedLogs] Loaded ${persistedLogs.length} logs from storage`
      );

      // Clear logger buffer to prevent re-adding persisted logs
      logger.clearBuffer();

      // Sort by timestamp (newest first)
      const sortedLogs = persistedLogs.sort(
        (a, b) => b.timestamp - a.timestamp
      );

      // DEBUG: Check for duplicates in loaded logs
      const idSet = new Set<string>();
      const duplicates: string[] = [];
      sortedLogs.forEach((log) => {
        if (idSet.has(log.id)) {
          duplicates.push(log.id);
        }
        idSet.add(log.id);
      });

      if (duplicates.length > 0) {
        console.error(
          `[loggingStore.loadPersistedLogs] Found ${duplicates.length} duplicate IDs in loaded logs`
        );
      }

      set({ logs: sortedLogs });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      get()._setError(errorMessage);
      console.error("Failed to load persisted logs:", error);
    } finally {
      get()._setLoading(false);
    }
  },

  // Set log filters
  setFilters: (filters: LogFilter) => {
    set({ filters });
  },

  // Update logger configuration
  updateConfig: async (config: Partial<LoggerConfig>) => {
    try {
      logger.updateConfig(config);
      set({ config: logger.getConfig() });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      get()._setError(errorMessage);
      console.error("Failed to update config:", error);
    }
  },

  // Export logs in specified format
  exportLogs: (format: "json" | "csv" | "txt") => {
    const filteredLogs = get().getFilteredLogs();
    return exportLogsToFormat(filteredLogs, format);
  },

  // Get filtered logs based on current filters
  getFilteredLogs: () => {
    const { logs, filters } = get();
    return filterLogs(logs, filters);
  },

  // Get log statistics
  getLogStats: () => {
    const filteredLogs = get().getFilteredLogs();
    return calculateStats(filteredLogs);
  },

  // Internal: Set loading state
  _setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  // Internal: Set error state
  _setError: (error: string | null) => {
    set({ error });
  },
}));

/**
 * Initialize logging store and connect with LoggerService
 */
export const initializeLoggingStore = () => {
  // Add storage handler to logger service
  logger.addHandler({
    name: "storage",
    enabled: true,
    handle: async (entry: LogEntry) => {
      // Add to Zustand store
      useLoggingStore.getState().addLog(entry);

      // Persist to AsyncStorage (debounced)
      if (logger.getConfig().persistLogs) {
        // Get current buffer from logger
        const buffer = logger.getLogs();

        // Only persist if buffer has multiple entries (batch operation)
        if (buffer.length >= 10) {
          console.log(
            `[loggingStore.initializeLoggingStore] Persisting ${buffer.length} logs to storage`
          );
          try {
            await logRotationService.saveLogs(buffer);
            // Don't clear buffer here as logger manages it
          } catch (error) {
            console.error("Failed to persist logs:", error);
          }
        }
      }
    },
  });

  // Load initial logs from storage
  useLoggingStore.getState().loadPersistedLogs();

  // Setup periodic cleanup (run once per day)
  const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
  setInterval(() => {
    logRotationService.cleanupOldLogs();
  }, cleanupInterval);

  // Initial cleanup
  logRotationService.cleanupOldLogs();
};

export default useLoggingStore;
