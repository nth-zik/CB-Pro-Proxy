import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ProxyProfile,
  VPNStatus,
  VPNStatusInfo,
  VPNConnectionStats,
} from "../types";
import { BulkOperationResult } from "../types/database";
import { logger } from "../services/LoggerService";

interface ProfileNotification {
  id: string;
  name: string;
  host?: string;
  port?: number;
  type?: string;
  isUpdate?: boolean;
}
import { storageService } from "../services";

interface VPNStore {
  // State
  profiles: ProxyProfile[];
  activeProfileId: string | null;
  vpnStatus: VPNStatus;
  isConnected: boolean;
  connectionStats: VPNConnectionStats;
  publicIp: string | null;
  error: string | null;
  isLoading: boolean;
  profileNotification: ProfileNotification | null;
  profilesLoaded: boolean;

  // Actions - Profile Management
  loadProfiles: (forceRefresh?: boolean) => Promise<void>;
  addProfile: (profile: ProxyProfile) => Promise<void>;
  addProfiles: (profiles: ProxyProfile[]) => Promise<void>;
  updateProfile: (profile: ProxyProfile) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  bulkDeleteProfiles: (ids: string[]) => Promise<BulkOperationResult>;
  selectProfile: (id: string) => Promise<void>;

  // Actions - VPN Control
  setVPNStatus: (status: VPNStatus | VPNStatusInfo) => void;
  setError: (error: unknown) => void;
  clearError: () => void;
  setProfileNotification: (notification: ProfileNotification | null) => void;
  clearProfileNotification: () => void;

  // Actions - UI State
  setLoading: (loading: boolean) => void;
}

const SELECTED_PROFILE_KEY = "@cbv_vpn_selected_profile";

const normalizeErrorMessage = (error: unknown): string | null => {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || error.toString();

  if (typeof error === "object") {
    // Attempt to read common fields first
    const possible =
      (error as any).message || (error as any).error || (error as any).reason;
    if (typeof possible === "string") return possible;
    try {
      return JSON.stringify(error);
    } catch (_jsonErr) {
      return "Unknown error";
    }
  }

  return "Unknown error";
};

export const useVPNStore = create<VPNStore>((set, get) => ({
  // Initial State
  profiles: [],
  activeProfileId: null,
  vpnStatus: "disconnected",
  isConnected: false,
  connectionStats: {
    durationMillis: 0,
    bytesUp: 0,
    bytesDown: 0,
  },
  publicIp: null,
  error: null,
  isLoading: false,
  profileNotification: null,
  profilesLoaded: false,

  // Profile Management Actions
  loadProfiles: async (forceRefresh = false) => {
    const state = get();

    // Skip if already loaded and not forcing refresh
    if (state.profilesLoaded && state.profiles.length > 0 && !forceRefresh) {
      // Removed verbose log: logger.debug("Profiles already loaded, skipping reload"...);
      return;
    }

    try {
      // Removed verbose log: logger.debug("Loading VPN profiles", "vpn", { forceRefresh });
      set({ isLoading: true, error: null });

      // Load profiles from storage
      const profiles = await storageService.getProfiles(forceRefresh);

      // Load initial active profile from AsyncStorage (fast)
      const storedId = await AsyncStorage.getItem(SELECTED_PROFILE_KEY);

      // Update state immediately with stored data
      set({
        profiles,
        activeProfileId: storedId,
        isLoading: false,
        profilesLoaded: true,
      });

      // Sync with Native in background to check for active VPN state
      (async () => {
        try {
          const { VPNModule } = await import("../native");
          const status = await VPNModule.getStatus();
          const isVPNActive =
            status?.state === "connected" || status?.state === "connecting";

          let nativeProfileId: string | null = null;

          if (isVPNActive) {
            // If VPN is active, trust Native source of truth
            nativeProfileId = await VPNModule.getActiveProfileId();

            if (nativeProfileId && nativeProfileId !== storedId) {
              logger.info("Syncing active profile with native module", "vpn", {
                stored: storedId,
                native: nativeProfileId,
              });
              set({ activeProfileId: nativeProfileId });
              await AsyncStorage.setItem(SELECTED_PROFILE_KEY, nativeProfileId);
            }
          } else if (!storedId) {
            // Fallback if no stored ID
            nativeProfileId = await VPNModule.getActiveProfileId();
            if (nativeProfileId) {
              set({ activeProfileId: nativeProfileId });
              await AsyncStorage.setItem(SELECTED_PROFILE_KEY, nativeProfileId);
            }
          }
        } catch (nativeError) {
          // Ignore native errors as we already have data
          // logger.warn("Background native sync failed", "vpn", nativeError);
        }
      })();
    } catch (error) {
      const errorMsg = normalizeErrorMessage(error) || "Unknown error";
      logger.error("Failed to load VPN profiles", "vpn", new Error(errorMsg));
      set({
        error: "Failed to load profiles",
        isLoading: false,
      });
    }
  },

  addProfile: async (profile: ProxyProfile) => {
    try {
      logger.info("Adding VPN profile", "vpn", {
        profileId: profile.id,
        profileName: profile.name,
        host: profile.host,
        port: profile.port,
        type: profile.type,
      });
      set({ isLoading: true, error: null });

      await storageService.saveProfile(profile);

      const profiles = [...get().profiles, profile];
      set({ profiles, isLoading: false, profilesLoaded: true });
      logger.info("VPN profile added successfully", "vpn", {
        profileId: profile.id,
        profileName: profile.name,
      });
    } catch (error) {
      const errorMsg = normalizeErrorMessage(error) || "Unknown error";
      logger.error("Failed to add VPN profile", "vpn", new Error(errorMsg), {
        profileId: profile.id,
      });
      set({
        error: "Failed to add profile",
        isLoading: false,
      });
      throw error;
    }
  },

  addProfiles: async (newProfiles: ProxyProfile[]) => {
    if (newProfiles.length === 0) return;
    try {
      logger.info(`Adding ${newProfiles.length} VPN profiles`, "vpn");
      set({ isLoading: true, error: null });

      await storageService.saveProfiles(newProfiles);

      const profiles = [...get().profiles, ...newProfiles];
      set({ profiles, isLoading: false, profilesLoaded: true });
      logger.info("VPN profiles bulk added successfully", "vpn", {
        count: newProfiles.length,
      });
    } catch (error) {
      const errorMsg = normalizeErrorMessage(error) || "Unknown error";
      logger.error(
        "Failed to bulk add VPN profiles",
        "vpn",
        new Error(errorMsg)
      );
      set({
        error: "Failed to bulk add profiles",
        isLoading: false,
      });
      throw error;
    }
  },

  updateProfile: async (profile: ProxyProfile) => {
    try {
      logger.info("Updating VPN profile", "vpn", {
        profileId: profile.id,
        profileName: profile.name,
        host: profile.host,
        port: profile.port,
      });
      set({ isLoading: true, error: null });

      await storageService.updateProfile(profile);

      const profiles = get().profiles.map((p) =>
        p.id === profile.id ? profile : p
      );

      set({ profiles, isLoading: false, profilesLoaded: true });
      logger.info("VPN profile updated successfully", "vpn", {
        profileId: profile.id,
        profileName: profile.name,
      });
    } catch (error) {
      const errorMsg = normalizeErrorMessage(error) || "Unknown error";
      logger.error("Failed to update VPN profile", "vpn", new Error(errorMsg), {
        profileId: profile.id,
      });
      set({
        error: "Failed to update profile",
        isLoading: false,
      });
      throw error;
    }
  },

  deleteProfile: async (id: string) => {
    try {
      const profileName = get().profiles.find((p) => p.id === id)?.name;
      logger.info("Deleting VPN profile", "vpn", {
        profileId: id,
        profileName,
      });
      set({ isLoading: true, error: null });

      await storageService.deleteProfile(id);

      const profiles = get().profiles.filter((p) => p.id !== id);
      const activeProfileId =
        get().activeProfileId === id ? null : get().activeProfileId;

      // Nếu profile đang active bị xóa, clear selection
      if (get().activeProfileId === id) {
        await AsyncStorage.removeItem(SELECTED_PROFILE_KEY);
        logger.debug("Cleared active profile selection", "vpn", {
          profileId: id,
        });
      }

      set({
        profiles,
        activeProfileId,
        isLoading: false,
        profilesLoaded: profiles.length > 0,
      });
      logger.info("VPN profile deleted successfully", "vpn", {
        profileId: id,
        profileName,
      });
    } catch (error) {
      const errorMsg = normalizeErrorMessage(error) || "Unknown error";
      logger.error("Failed to delete VPN profile", "vpn", new Error(errorMsg), {
        profileId: id,
      });
      set({
        error: "Failed to delete profile",
        isLoading: false,
      });
      throw error;
    }
  },

  bulkDeleteProfiles: async (ids: string[]) => {
    if (ids.length === 0) {
      return {
        success: true,
        totalCount: 0,
        successCount: 0,
        failureCount: 0,
        errors: [],
      };
    }

    try {
      logger.info(`Bulk deleting ${ids.length} VPN profiles`, "vpn");
      set({ isLoading: true, error: null });

      // Use batch deletion from storage service
      const result = await storageService.bulkDeleteProfiles(ids);

      // Update state by filtering out deleted profiles
      const profiles = get().profiles.filter((p) => !ids.includes(p.id));
      
      // Check if active profile was deleted
      let activeProfileId = get().activeProfileId;
      if (activeProfileId && ids.includes(activeProfileId)) {
        activeProfileId = null;
        await AsyncStorage.removeItem(SELECTED_PROFILE_KEY);
        logger.debug("Cleared active profile selection (deleted in bulk)", "vpn");
      }

      set({
        profiles,
        activeProfileId,
        isLoading: false,
        profilesLoaded: profiles.length > 0,
      });

      logger.info("Bulk delete completed", "vpn", {
        total: result.totalCount,
        success: result.successCount,
        failed: result.failureCount,
      });

      return result;
    } catch (error) {
      const errorMsg = normalizeErrorMessage(error) || "Unknown error";
      logger.error("Failed to bulk delete VPN profiles", "vpn", new Error(errorMsg));
      set({
        error: "Failed to bulk delete profiles",
        isLoading: false,
      });
      throw error;
    }
  },

  selectProfile: async (id: string) => {
    try {
      const profileName = get().profiles.find((p) => p.id === id)?.name;
      logger.info("Selecting VPN profile", "vpn", {
        profileId: id,
        profileName,
      });
      set({ error: null });

      // Optimistic update: Update state immediately without waiting for storage
      set({ activeProfileId: id });

      // Persist to storage in background
      AsyncStorage.setItem(SELECTED_PROFILE_KEY, id).catch((err) => {
        const errorMsg = normalizeErrorMessage(err) || "Unknown error";
        logger.error(
          "Failed to persist selected profile",
          "vpn",
          new Error(errorMsg)
        );
      });

      logger.debug("VPN profile selected successfully", "vpn", {
        profileId: id,
        profileName,
      });
    } catch (error) {
      const errorMsg = normalizeErrorMessage(error) || "Unknown error";
      logger.error("Failed to select VPN profile", "vpn", new Error(errorMsg), {
        profileId: id,
      });
      set({ error: "Failed to select profile" });
      throw error;
    }
  },

  // VPN Control Actions
  setVPNStatus: (status) => {
    if (typeof status === "string") {
      logger.info("VPN status changed", "vpn", {
        status,
        isConnected: status === "connected",
      });

      // Simple log by status
      const profileName =
        get().profiles.find((p) => p.id === get().activeProfileId)?.name ||
        "Unknown";
      // Only log important status changes (connected/error) to reduce noise
      if (status === "connected") {
        logger.info(`✅ Connection successful: ${profileName}`, "vpn");
      } else if (status === "error") {
        logger.error(`❌ Connection failed: ${profileName}`, "vpn");
      }
      // Removed connecting/disconnected logs

      set({
        vpnStatus: status,
        isConnected: status === "connected",
        connectionStats: {
          durationMillis:
            status === "connected" ? get().connectionStats.durationMillis : 0,
          bytesUp: status === "connected" ? get().connectionStats.bytesUp : 0,
          bytesDown:
            status === "connected" ? get().connectionStats.bytesDown : 0,
          publicIp:
            status === "connected" ? get().connectionStats.publicIp : undefined,
        },
        publicIp: status === "connected" ? get().publicIp : null,
      });
      if (status !== "connected") {
        set({ error: status === "error" ? get().error : null });
      } else {
        set({ error: null });
      }
      return;
    }

    const statusInfo = status as VPNStatusInfo;
    logger.info("VPN status updated", "vpn", {
      state: statusInfo.state,
      isConnected: statusInfo.isConnected,
      publicIp: statusInfo.stats.publicIp,
    });

    // Simple log with more details
    const profileName =
      get().profiles.find((p) => p.id === get().activeProfileId)?.name ||
      "Unknown";

    // Only log important status changes (connected/error)
    if (statusInfo.state === "connected") {
      const connectionTime = new Date().toLocaleString("en-US");
      logger.info(
        `✅ Connection successful: ${profileName} - ${connectionTime}`,
        "vpn",
        {
          publicIp: statusInfo.stats.publicIp,
        }
      );
    } else if (statusInfo.state === "error") {
      logger.error(`❌ Connection failed: ${profileName}`, "vpn");
    }
    // Removed connecting/disconnected logs

    set({
      vpnStatus: statusInfo.state,
      isConnected: statusInfo.isConnected,
      connectionStats: statusInfo.stats,
      publicIp: statusInfo.stats.publicIp ?? null,
    });

    if (statusInfo.state === "connected") {
      set({ error: null });
    }
  },

  setError: (error: unknown) => {
    const message = normalizeErrorMessage(error);

    if (message) {
      logger.error("VPN error occurred", "vpn", new Error(message));

      // Simple log for users
      const profileName =
        get().profiles.find((p) => p.id === get().activeProfileId)?.name ||
        "Unknown";
      logger.error(`❌ Connection error: ${profileName} - ${message}`, "vpn");
    }

    set({ error: message });

    // Nếu có error, set status về error
    if (message) {
      set({
        vpnStatus: "error",
        isConnected: false,
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  setProfileNotification: (notification: ProfileNotification | null) => {
    set({ profileNotification: notification });
  },

  clearProfileNotification: () => {
    set({ profileNotification: null });
  },

  // UI State Actions
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
}));
