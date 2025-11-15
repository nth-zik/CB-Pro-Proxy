/**
 * useLogger Hook - React hook for easy logging access
 *
 * Features:
 * - Convenient wrapper around LoggerService
 * - Auto-inject category context
 * - TypeScript typed methods
 * - Easy integration in components
 */

import { useCallback } from "react";
import { logger } from "../services/LoggerService";
import type { LogCategory, VPNStatus } from "../types/logging";

/**
 * Logger hook options
 */
interface UseLoggerOptions {
  /** Default category for all logs from this hook */
  defaultCategory?: LogCategory;

  /** Default profile ID for all logs from this hook */
  defaultProfileId?: string;

  /** Default VPN status for all logs from this hook */
  defaultVPNStatus?: VPNStatus;
}

/**
 * Logger hook return type
 */
interface UseLoggerReturn {
  /**
   * Log a debug message
   * @param message Human-readable message
   * @param category Log category (optional if defaultCategory is set)
   * @param data Additional structured data
   */
  logDebug: (message: string, category?: LogCategory, data?: any) => void;

  /**
   * Log an info message
   * @param message Human-readable message
   * @param category Log category (optional if defaultCategory is set)
   * @param data Additional structured data
   */
  logInfo: (message: string, category?: LogCategory, data?: any) => void;

  /**
   * Log a warning message
   * @param message Human-readable message
   * @param category Log category (optional if defaultCategory is set)
   * @param data Additional structured data
   */
  logWarn: (message: string, category?: LogCategory, data?: any) => void;

  /**
   * Log an error message
   * @param message Human-readable message
   * @param category Log category (optional if defaultCategory is set)
   * @param error Error object
   * @param data Additional structured data
   */
  logError: (
    message: string,
    category?: LogCategory,
    error?: Error,
    data?: any
  ) => void;

  /**
   * Log a critical error message
   * @param message Human-readable message
   * @param category Log category (optional if defaultCategory is set)
   * @param error Error object
   * @param data Additional structured data
   */
  logCritical: (
    message: string,
    category?: LogCategory,
    error?: Error,
    data?: any
  ) => void;

  /**
   * Check if logger is enabled
   */
  isEnabled: boolean;
}

/**
 * useLogger hook - Provides easy access to logging functionality
 *
 * @param options Hook options
 * @returns Logger methods
 *
 * @example
 * ```tsx
 * // Basic usage with default category
 * const { logInfo, logError } = useLogger({ defaultCategory: 'ui' });
 *
 * logInfo('Button clicked');
 * logError('Failed to load data', undefined, error);
 *
 * // Usage with custom category per call
 * const { logDebug } = useLogger();
 * logDebug('Network request', 'network', { url: '/api/data' });
 * ```
 */
export const useLogger = (options: UseLoggerOptions = {}): UseLoggerReturn => {
  const {
    defaultCategory = "app",
    defaultProfileId,
    defaultVPNStatus,
  } = options;

  /**
   * Log debug message
   */
  const logDebug = useCallback(
    (message: string, category?: LogCategory, data?: any) => {
      const mergedData = {
        ...data,
        ...(defaultProfileId && { profileId: defaultProfileId }),
        ...(defaultVPNStatus && { vpnStatus: defaultVPNStatus }),
      };

      logger.debug(
        message,
        category || defaultCategory,
        Object.keys(mergedData).length > 0 ? mergedData : data
      );
    },
    [defaultCategory, defaultProfileId, defaultVPNStatus]
  );

  /**
   * Log info message
   */
  const logInfo = useCallback(
    (message: string, category?: LogCategory, data?: any) => {
      const mergedData = {
        ...data,
        ...(defaultProfileId && { profileId: defaultProfileId }),
        ...(defaultVPNStatus && { vpnStatus: defaultVPNStatus }),
      };

      logger.info(
        message,
        category || defaultCategory,
        Object.keys(mergedData).length > 0 ? mergedData : data
      );
    },
    [defaultCategory, defaultProfileId, defaultVPNStatus]
  );

  /**
   * Log warning message
   */
  const logWarn = useCallback(
    (message: string, category?: LogCategory, data?: any) => {
      const mergedData = {
        ...data,
        ...(defaultProfileId && { profileId: defaultProfileId }),
        ...(defaultVPNStatus && { vpnStatus: defaultVPNStatus }),
      };

      logger.warn(
        message,
        category || defaultCategory,
        Object.keys(mergedData).length > 0 ? mergedData : data
      );
    },
    [defaultCategory, defaultProfileId, defaultVPNStatus]
  );

  /**
   * Log error message
   */
  const logError = useCallback(
    (message: string, category?: LogCategory, error?: Error, data?: any) => {
      const mergedData = {
        ...data,
        ...(defaultProfileId && { profileId: defaultProfileId }),
        ...(defaultVPNStatus && { vpnStatus: defaultVPNStatus }),
      };

      logger.error(
        message,
        category || defaultCategory,
        error,
        Object.keys(mergedData).length > 0 ? mergedData : data
      );
    },
    [defaultCategory, defaultProfileId, defaultVPNStatus]
  );

  /**
   * Log critical error message
   */
  const logCritical = useCallback(
    (message: string, category?: LogCategory, error?: Error, data?: any) => {
      const mergedData = {
        ...data,
        ...(defaultProfileId && { profileId: defaultProfileId }),
        ...(defaultVPNStatus && { vpnStatus: defaultVPNStatus }),
      };

      logger.critical(
        message,
        category || defaultCategory,
        error,
        Object.keys(mergedData).length > 0 ? mergedData : data
      );
    },
    [defaultCategory, defaultProfileId, defaultVPNStatus]
  );

  return {
    logDebug,
    logInfo,
    logWarn,
    logError,
    logCritical,
    isEnabled: logger.isEnabled(),
  };
};

/**
 * Hook for VPN-specific logging
 * Pre-configured with 'vpn' category
 *
 * @example
 * ```tsx
 * const { logInfo, logError } = useVPNLogger();
 * logInfo('VPN connection started');
 * ```
 */
export const useVPNLogger = (profileId?: string, vpnStatus?: VPNStatus) => {
  return useLogger({
    defaultCategory: "vpn",
    defaultProfileId: profileId,
    defaultVPNStatus: vpnStatus,
  });
};

/**
 * Hook for UI-specific logging
 * Pre-configured with 'ui' category
 *
 * @example
 * ```tsx
 * const { logInfo } = useUILogger();
 * logInfo('Settings screen opened');
 * ```
 */
export const useUILogger = () => {
  return useLogger({
    defaultCategory: "ui",
  });
};

/**
 * Hook for network-specific logging
 * Pre-configured with 'network' category
 *
 * @example
 * ```tsx
 * const { logInfo, logError } = useNetworkLogger();
 * logInfo('API request started', undefined, { endpoint: '/api/data' });
 * ```
 */
export const useNetworkLogger = () => {
  return useLogger({
    defaultCategory: "network",
  });
};

/**
 * Hook for storage-specific logging
 * Pre-configured with 'storage' category
 *
 * @example
 * ```tsx
 * const { logInfo, logError } = useStorageLogger();
 * logInfo('Profile saved successfully');
 * ```
 */
export const useStorageLogger = () => {
  return useLogger({
    defaultCategory: "storage",
  });
};

export default useLogger;
