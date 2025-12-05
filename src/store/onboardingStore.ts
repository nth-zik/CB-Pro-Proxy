import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_COMPLETED_KEY = "@cbv_vpn_onboarding_completed";

interface OnboardingStore {
  hasCompletedOnboarding: boolean | null;
  isLoading: boolean;

  // Actions
  loadOnboardingStatus: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  hasCompletedOnboarding: null,
  isLoading: true,

  loadOnboardingStatus: async () => {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      set({
        hasCompletedOnboarding: value === "true",
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to load onboarding status:", error);
      set({
        hasCompletedOnboarding: false,
        isLoading: false,
      });
    }
  },

  completeOnboarding: async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
      set({ hasCompletedOnboarding: true });
    } catch (error) {
      console.error("Failed to save onboarding status:", error);
    }
  },

  resetOnboarding: async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
      set({ hasCompletedOnboarding: false });
    } catch (error) {
      console.error("Failed to reset onboarding status:", error);
    }
  },
}));
