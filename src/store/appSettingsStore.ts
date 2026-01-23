import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTO_SWITCH_UNHEALTHY_KEY = "@cbv_vpn_auto_switch_unhealthy";

interface AppSettingsStore {
  autoSwitchUnhealthy: boolean;
  isLoading: boolean;
  hasLoaded: boolean;
  loadSettings: () => Promise<void>;
  setAutoSwitchUnhealthy: (value: boolean) => Promise<void>;
}

export const useAppSettingsStore = create<AppSettingsStore>((set, get) => ({
  autoSwitchUnhealthy: true,
  isLoading: false,
  hasLoaded: false,

  loadSettings: async () => {
    if (get().isLoading || get().hasLoaded) return;
    set({ isLoading: true });
    try {
      const stored = await AsyncStorage.getItem(AUTO_SWITCH_UNHEALTHY_KEY);
      if (stored === "true" || stored === "false") {
        set({ autoSwitchUnhealthy: stored === "true" });
      }
      set({ hasLoaded: true });
    } catch (error) {
      console.error("Failed to load app settings:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  setAutoSwitchUnhealthy: async (value) => {
    const previous = get().autoSwitchUnhealthy;
    set({ autoSwitchUnhealthy: value });
    try {
      await AsyncStorage.setItem(
        AUTO_SWITCH_UNHEALTHY_KEY,
        value ? "true" : "false"
      );
    } catch (error) {
      console.error("Failed to save auto-switch setting:", error);
      set({ autoSwitchUnhealthy: previous });
      throw error;
    }
  },
}));
