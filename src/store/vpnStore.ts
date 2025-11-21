import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ProxyProfile,
  VPNStatus,
  VPNStatusInfo,
  VPNConnectionStats,
} from "../types";
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
  updateProfile: (profile: ProxyProfile) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
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
      logger.debug("Profiles already loaded, skipping reload", "vpn", {
        profileCount: state.profiles.length,
      });
      return;
    }

    try {
      logger.debug("Loading VPN profiles", "vpn", { forceRefresh });
      set({ isLoading: true, error: null });

      // Load profiles từ storage
      const profiles = await storageService.getProfiles();
      logger.debug("Profiles loaded from storage", "storage", {
        count: profiles.length,
      });

      // Load selected profile từ native SharedPreferences (priority)
      // This ensures we get the profile set via ADB or native code
      let selectedProfileId: string | null = null;
      try {
        const { VPNModule } = await import("../native");
        selectedProfileId = await VPNModule.getActiveProfileId();
        logger.debug("Loaded active profile from native", "vpn", {
          profileId: selectedProfileId,
        });
      } catch (nativeError) {
        logger.warn(
          "Failed to load active profile from native, falling back to AsyncStorage",
          "vpn",
          nativeError
        );
      }

      // Fallback to AsyncStorage if native returns null
      if (!selectedProfileId) {
        selectedProfileId = await AsyncStorage.getItem(SELECTED_PROFILE_KEY);
        logger.debug("Loaded active profile from AsyncStorage", "storage", {
          profileId: selectedProfileId,
        });
      }

      // Sync to AsyncStorage if we got it from native
      if (selectedProfileId) {
        await AsyncStorage.setItem(SELECTED_PROFILE_KEY, selectedProfileId);
      }

      set({
        profiles,
        activeProfileId: selectedProfileId,
        isLoading: false,
        profilesLoaded: true,
      });
      logger.info("VPN profiles loaded successfully", "vpn", {
        profileCount: profiles.length,
        activeProfileId: selectedProfileId,
      });
    } catch (error) {
      logger.error("Failed to load VPN profiles", "vpn", error as Error);
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
      logger.error("Failed to add VPN profile", "vpn", error as Error, {
        profileId: profile.id,
      });
      set({
        error: "Failed to add profile",
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
      logger.error("Failed to update VPN profile", "vpn", error as Error, {
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
      logger.error("Failed to delete VPN profile", "vpn", error as Error, {
        profileId: id,
      });
      set({
        error: "Failed to delete profile",
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

      // Persist selected profile
      await AsyncStorage.setItem(SELECTED_PROFILE_KEY, id);

      set({ activeProfileId: id });
      logger.debug("VPN profile selected successfully", "vpn", {
        profileId: id,
        profileName,
      });
    } catch (error) {
      logger.error("Failed to select VPN profile", "vpn", error as Error, {
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
      if (status === "connected") {
        logger.info(`✅ Connection successful: ${profileName}`, "vpn");
      } else if (status === "connecting") {
        logger.info(`🔄 Connecting: ${profileName}`, "vpn");
      } else if (status === "disconnected") {
        logger.info(`⚪ Disconnected: ${profileName}`, "vpn");
      } else if (status === "error") {
        logger.error(`❌ Connection failed: ${profileName}`, "vpn");
      }

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
    if (statusInfo.state === "connected") {
      const connectionTime = new Date().toLocaleString("en-US");
      logger.info(
        `✅ Connection successful: ${profileName} - ${connectionTime}`,
        "vpn",
        {
          publicIp: statusInfo.stats.publicIp,
        }
      );
    } else if (statusInfo.state === "connecting") {
      logger.info(`🔄 Connecting: ${profileName}`, "vpn");
    } else if (statusInfo.state === "disconnected") {
      logger.info(`⚪ Disconnected: ${profileName}`, "vpn");
    } else if (statusInfo.state === "error") {
      logger.error(`❌ Connection failed: ${profileName}`, "vpn");
    }

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
