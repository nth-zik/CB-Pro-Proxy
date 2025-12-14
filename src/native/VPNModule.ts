import { NativeModules, NativeEventEmitter } from "react-native";
import type { VPNStatusInfo, VPNConnectionStats } from "../types";
import { logger } from "../services/LoggerService";

const LINKING_ERROR =
  "The package 'VPNModule' doesn't seem to be linked. Make sure:\n" +
  "- You rebuilt the app after installing the package\n" +
  "- You are not using Expo Go\n";

type NativeVPNModuleShape = {
  getProfiles(): Promise<any[]>;
  getActiveProfileId(): Promise<string | null>;
  saveProfile(
    name: string,
    host: string,
    port: number,
    type: string,
    username: string,
    password: string
  ): Promise<string>;
  deleteProfile(profileId: string): Promise<void>;
  startVPN(profileId: string): Promise<void>;
  startVPNWithProfile(
    name: string,
    host: string,
    port: number,
    type: string,
    username: string,
    password: string,
    dns1?: string,
    dns2?: string
  ): Promise<void>;
  stopVPN(force?: boolean): Promise<void>;
  getStatus(): Promise<any>;
  refreshStatus(): void;
  setAutoConnectEnabled(enabled: boolean): Promise<void>;
  getAutoConnectEnabled(): Promise<boolean>;
  openVPNSettings(): Promise<boolean>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
  checkProxyHealth?: (
    type: string,
    host: string,
    port: number,
    username: string,
    password: string
  ) => Promise<{ ok: boolean; latencyMs?: number; error?: string }>;
  prepareVPN(): Promise<boolean>;
  setPowerProfile(profile: string): Promise<void>;
  getPowerProfile(): Promise<string>;
};

type ProfilesUpdatedPayload = {
  id?: string;
  name?: string;
  host?: string;
  port?: number;
  type?: string;
  hasAuth?: boolean;
  isUpdate?: boolean;
};

type VPNPermissionRequiredPayload = {
  profileId?: string;
  profileName?: string;
};

type ActiveProfileChangedPayload = {
  profileId?: string;
  profileName?: string;
};

const NativeVPNModule: NativeVPNModuleShape | undefined =
  NativeModules.VPNModule;

if (!NativeVPNModule) {
  logger.critical(
    "Native VPN module not found",
    "vpn",
    undefined,
    new Error(LINKING_ERROR)
  );
  throw new Error(LINKING_ERROR);
}

logger.info("Native VPN module initialized successfully", "vpn");
const eventEmitter = new NativeEventEmitter(NativeVPNModule as any);

type NativeStatusPayload = {
  state?: string;
  isConnected?: boolean;
  durationMillis?: number;
  bytesUp?: number;
  bytesDown?: number;
  publicIp?: string;
};

const normalizeStatus = (payload: NativeStatusPayload): VPNStatusInfo => {
  const stats: VPNConnectionStats = {
    durationMillis: Number(payload?.durationMillis) || 0,
    bytesUp: Number(payload?.bytesUp) || 0,
    bytesDown: Number(payload?.bytesDown) || 0,
    publicIp: payload?.publicIp,
  };

  if (payload?.state === "connected" || payload?.isConnected === true) {
    return {
      state: "connected",
      isConnected: true,
      stats,
    };
  }

  if (payload?.state === "connecting") {
    return {
      state: "connecting",
      isConnected: false,
      stats,
    };
  }

  if (payload?.state === "handshaking") {
    return {
      state: "handshaking",
      isConnected: false,
      stats,
    };
  }

  if (payload?.state === "proxy_error") {
    return {
      state: "proxy_error",
      isConnected: false,
      stats,
    };
  }

  if (payload?.state === "error") {
    return {
      state: "error",
      isConnected: false,
      stats,
    };
  }

  return {
    state: "disconnected",
    isConnected: false,
    stats,
  };
};

export const VPNModule = {
  getProfiles: async () => {
    try {
      // Removed verbose log: logger.debug("Getting VPN profiles", "vpn");
      const profiles = await NativeVPNModule.getProfiles();
      // Removed verbose log: logger.debug("Retrieved VPN profiles", "vpn", { count: profiles.length });
      return profiles;
    } catch (error) {
      logger.error("Failed to get VPN profiles", "vpn", error as Error);
      throw error;
    }
  },
  getActiveProfileId: async () => {
    try {
      // Removed verbose log: logger.debug("Getting active profile ID", "vpn");
      const profileId = await NativeVPNModule.getActiveProfileId();
      // Removed verbose log: logger.debug("Retrieved active profile ID", "vpn", { profileId });
      return profileId;
    } catch (error) {
      logger.error("Failed to get active profile ID", "vpn", error as Error);
      throw error;
    }
  },
  saveProfile: async (
    name: string,
    host: string,
    port: number,
    type: string,
    username: string,
    password: string
  ) => {
    try {
      logger.info("Saving VPN profile", "vpn", {
        name,
        host,
        port,
        type,
        hasAuth: !!username,
      });
      const profileId = await NativeVPNModule.saveProfile(
        name,
        host,
        port,
        type,
        username,
        password
      );
      logger.info("VPN profile saved successfully", "vpn", { profileId, name });
      return profileId;
    } catch (error) {
      logger.error("Failed to save VPN profile", "vpn", error as Error, {
        name,
        host,
        port,
        type,
      });
      throw error;
    }
  },
  deleteProfile: async (profileId: string) => {
    try {
      logger.info("Deleting VPN profile", "vpn", { profileId });
      await NativeVPNModule.deleteProfile(profileId);
      logger.info("VPN profile deleted successfully", "vpn", { profileId });
    } catch (error) {
      logger.error("Failed to delete VPN profile", "vpn", error as Error, {
        profileId,
      });
      throw error;
    }
  },
  startVPN: async (profileId: string) => {
    try {
      logger.info("Starting VPN connection", "vpn", { profileId });
      // Simple log for users
      logger.info("Connecting to proxy...", "vpn", { profileId });

      const startTime = Date.now();
      await NativeVPNModule.startVPN(profileId);

      logger.info("VPN connection start requested", "vpn", { profileId });
    } catch (error) {
      logger.error("Failed to start VPN connection", "vpn", error as Error, {
        profileId,
      });
      // Simple log when connection fails
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `Connection failed: ${errorMessage}`,
        "vpn",
        error as Error,
        {
          profileId,
        }
      );
      throw error;
    }
  },
  startVPNWithProfile: async (
    name: string,
    host: string,
    port: number,
    type: string,
    username: string,
    password: string,
    dns1?: string,
    dns2?: string
  ) => {
    try {
      logger.info("Starting VPN with profile", "vpn", {
        name,
        host,
        port,
        type,
        hasAuth: !!username,
        hasDNS: !!(dns1 || dns2),
      });
      // Simple log for users
      logger.info(`Connecting to proxy: ${name} (${host}:${port})`, "vpn");

      const startTime = Date.now();
      await NativeVPNModule.startVPNWithProfile(
        name,
        host,
        port,
        type,
        username,
        password,
        dns1,
        dns2
      );

      logger.info("VPN connection with profile start requested", "vpn", {
        name,
      });
    } catch (error) {
      logger.error("Failed to start VPN with profile", "vpn", error as Error, {
        name,
        host,
        port,
        type,
      });
      // Simple log when connection fails
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `Connection failed: ${name} - ${errorMessage}`,
        "vpn",
        error as Error
      );
      throw error;
    }
  },
  stopVPN: async (force = false) => {
    try {
      logger.info("Stopping VPN connection", "vpn");
      await NativeVPNModule.stopVPN(force);
      logger.info("VPN connection stop requested", "vpn");
    } catch (error) {
      logger.error("Failed to stop VPN connection", "vpn", error as Error);
      throw error;
    }
  },
  getStatus: async (): Promise<VPNStatusInfo> => {
    try {
      logger.debug("Getting VPN status", "vpn");
      const payload = await NativeVPNModule.getStatus();
      const status = normalizeStatus(payload ?? {});
      // Removed verbose log to reduce noise: logger.debug("Retrieved VPN status"...)
      return status;
    } catch (error) {
      logger.error("Failed to get VPN status", "vpn", error as Error);
      throw error;
    }
  },
  refreshStatus: () => {
    try {
      logger.debug("Refreshing VPN status", "vpn");
      NativeVPNModule.refreshStatus();
    } catch (error) {
      logger.error("Failed to refresh VPN status", "vpn", error as Error);
    }
  },
  setAutoConnectEnabled: async (enabled: boolean): Promise<void> => {
    try {
      logger.info("Setting auto-connect preference", "vpn", { enabled });
      await NativeVPNModule.setAutoConnectEnabled(enabled);
      logger.info("Auto-connect preference updated", "vpn", { enabled });
    } catch (error) {
      logger.error(
        "Failed to set auto-connect preference",
        "vpn",
        error as Error
      );
      throw error;
    }
  },
  getAutoConnectEnabled: async (): Promise<boolean> => {
    try {
      logger.debug("Getting auto-connect preference", "vpn");
      const enabled = await NativeVPNModule.getAutoConnectEnabled();
      logger.debug("Retrieved auto-connect preference", "vpn", { enabled });
      return enabled;
    } catch (error) {
      logger.error(
        "Failed to get auto-connect preference",
        "vpn",
        error as Error
      );
      throw error;
    }
  },
  openVPNSettings: async (): Promise<boolean> => {
    try {
      logger.debug("Opening system VPN settings", "vpn");
      const result = await NativeVPNModule.openVPNSettings();
      logger.debug("Opened system VPN settings", "vpn");
      return result;
    } catch (error) {
      logger.error("Failed to open VPN settings", "vpn", error as Error);
      throw error;
    }
  },
  checkProxyHealth: async (
    type: string,
    host: string,
    port: number,
    username: string,
    password: string
  ): Promise<{ ok: boolean; latencyMs?: number; error?: string } | null> => {
    try {
      if (!NativeVPNModule.checkProxyHealth) {
        return null;
      }
      const res = await NativeVPNModule.checkProxyHealth(
        type,
        host,
        port,
        username,
        password
      );
      return res ?? null;
    } catch (error) {
      logger.error("Failed to check proxy health", "vpn", error as Error, {
        type,
        host,
        port,
      });
      throw error;
    }
  },
  prepareVPN: async (): Promise<boolean> => {
    try {
      logger.debug("Preparing VPN permission", "vpn");
      const result = await NativeVPNModule.prepareVPN();
      logger.debug("VPN permission prepared", "vpn", { granted: result });
      return result;
    } catch (error) {
      logger.error("Failed to prepare VPN permission", "vpn", error as Error);
      throw error;
    }
  },
  setPowerProfile: async (profile: string): Promise<void> => {
    try {
      logger.info("Setting power profile", "app", { profile });
      await NativeVPNModule.setPowerProfile(profile);
      logger.info("Power profile updated", "app", { profile });
    } catch (error) {
      logger.error("Failed to set power profile", "app", error as Error);
      throw error;
    }
  },
  getPowerProfile: async (): Promise<string> => {
    try {
      const profile = await NativeVPNModule.getPowerProfile();
      return profile || "balanced";
    } catch (error) {
      logger.error("Failed to get power profile", "app", error as Error);
      return "balanced"; // Default fallback
    }
  },
  addStatusChangeListener: (callback: (status: VPNStatusInfo) => void) => {
    // Removed verbose log: logger.debug("Adding VPN status change listener", "vpn");
    const subscription = eventEmitter.addListener(
      "statusChanged",
      (payload: NativeStatusPayload) => {
        const status = normalizeStatus(payload ?? {});
        if (status.state === "error") {
          logger.error("Connection error", "vpn");
        }
        // Removed all other info/debug logs here
        callback(status);
      }
    );
    return {
      remove: () => {
        // Removed verbose log: logger.debug("Removing VPN status change listener", "vpn");
        subscription.remove();
      },
    };
  },
  addErrorListener: (callback: (error: string) => void) => {
    logger.debug("Adding VPN error listener", "vpn");
    const subscription = eventEmitter.addListener("error", (message: any) => {
      const errorMessage =
        typeof message === "string"
          ? message
          : message?.message || JSON.stringify(message);
      logger.error("VPN error event received", "vpn", new Error(errorMessage));
      callback(errorMessage);
    });
    return {
      remove: () => {
        logger.debug("Removing VPN error listener", "vpn");
        subscription.remove();
      },
    };
  },
  addProfilesUpdatedListener: (
    callback: (payload: ProfilesUpdatedPayload) => void
  ) => {
    logger.debug("Adding profiles updated listener", "vpn");
    const subscription = eventEmitter.addListener(
      "profilesUpdated",
      (payload: ProfilesUpdatedPayload) => {
        logger.info("Profiles updated event received", "vpn", {
          profileId: payload?.id,
          profileName: payload?.name,
          isUpdate: payload?.isUpdate,
        });
        callback(payload ?? {});
      }
    );
    return {
      remove: () => {
        logger.debug("Removing profiles updated listener", "vpn");
        subscription.remove();
      },
    };
  },
  addVPNPermissionRequiredListener: (
    callback: (payload: VPNPermissionRequiredPayload) => void
  ) => {
    logger.debug("Adding VPN permission required listener", "vpn");
    const subscription = eventEmitter.addListener(
      "vpnPermissionRequired",
      (payload: VPNPermissionRequiredPayload) => {
        logger.warn("VPN permission required", "vpn", {
          profileId: payload?.profileId,
          profileName: payload?.profileName,
        });
        callback(payload ?? {});
      }
    );
    return {
      remove: () => {
        logger.debug("Removing VPN permission required listener", "vpn");
        subscription.remove();
      },
    };
  },
  addActiveProfileChangedListener: (
    callback: (payload: ActiveProfileChangedPayload) => void
  ) => {
    logger.debug("Adding active profile changed listener", "vpn");
    const subscription = eventEmitter.addListener(
      "activeProfileChanged",
      (payload: ActiveProfileChangedPayload) => {
        logger.info("Active profile changed event received", "vpn", {
          profileId: payload?.profileId,
          profileName: payload?.profileName,
        });
        callback(payload ?? {});
      }
    );
    return {
      remove: () => {
        logger.debug("Removing active profile changed listener", "vpn");
        subscription.remove();
      },
    };
  },
};

export type VPNModuleInterface = typeof VPNModule;

export const VPNModuleEmitter = eventEmitter;

export default VPNModule;
