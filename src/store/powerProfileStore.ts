/**
 * Power Profile Store - Manages power/battery profiles for VPN service
 *
 * Profiles:
 * - Performance: Fast response, higher battery usage
 * - Balanced: Default, good balance between performance and battery
 * - Battery Saver: Maximum battery savings, slower response
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "../services/LoggerService";

export type PowerProfile = "performance" | "balanced" | "battery_saver";

export interface PowerProfileConfig {
    healthCheckIntervalMs: number;
    publicIpCheckIntervalMs: number;
    maxSleepMs: number;
    statusBroadcastPacketInterval: number;
}

export const POWER_PROFILES: Record<PowerProfile, PowerProfileConfig> = {
    performance: {
        healthCheckIntervalMs: 15000, // 15s
        publicIpCheckIntervalMs: 30000, // 30s
        maxSleepMs: 10, // 10ms
        statusBroadcastPacketInterval: 200,
    },
    balanced: {
        healthCheckIntervalMs: 60000, // 60s
        publicIpCheckIntervalMs: 180000, // 3 min
        maxSleepMs: 50, // 50ms
        statusBroadcastPacketInterval: 1000,
    },
    battery_saver: {
        healthCheckIntervalMs: 120000, // 2 min
        publicIpCheckIntervalMs: 600000, // 10 min
        maxSleepMs: 200, // 200ms
        statusBroadcastPacketInterval: 5000,
    },
};

export interface PowerProfileInfo {
    id: PowerProfile;
    name: string;
    icon: string;
    description: string;
}

export const POWER_PROFILE_INFO: PowerProfileInfo[] = [
    {
        id: "performance",
        name: "Performance",
        icon: "flash",
        description: "Fast response, higher battery usage",
    },
    {
        id: "balanced",
        name: "Balanced",
        icon: "speedometer",
        description: "Good balance between speed and battery",
    },
    {
        id: "battery_saver",
        name: "Battery Saver",
        icon: "battery-charging",
        description: "Maximum battery savings",
    },
];

interface PowerProfileStore {
    // State
    currentProfile: PowerProfile;
    isLoading: boolean;

    // Actions
    loadProfile: () => Promise<void>;
    setProfile: (profile: PowerProfile) => Promise<void>;
    getConfig: () => PowerProfileConfig;
}

const STORAGE_KEY = "@cbv_power_profile";
const DEFAULT_PROFILE: PowerProfile = "balanced";

export const usePowerProfileStore = create<PowerProfileStore>((set, get) => ({
    currentProfile: DEFAULT_PROFILE,
    isLoading: false,

    loadProfile: async () => {
        // Only load once - check if already loaded
        if (get().isLoading) return;

        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored && (stored === "performance" || stored === "balanced" || stored === "battery_saver")) {
                set({ currentProfile: stored as PowerProfile });
            }
        } catch (error) {
            // Silently fail - use default profile
            console.warn("Failed to load power profile:", error);
        }
    },

    setProfile: async (profile: PowerProfile) => {
        try {
            set({ currentProfile: profile });
            await AsyncStorage.setItem(STORAGE_KEY, profile);

            // Sync with native module
            try {
                const { VPNModule } = await import("../native");
                await VPNModule.setPowerProfile(profile);
                logger.info("Power profile updated", "app", { profile });
            } catch (nativeError) {
                logger.warn("Failed to sync power profile to native", "app", {
                    error: (nativeError as Error).message
                });
            }
        } catch (error) {
            logger.error("Failed to save power profile", "app", error as Error);
            throw error;
        }
    },

    getConfig: () => {
        return POWER_PROFILES[get().currentProfile];
    },
}));
