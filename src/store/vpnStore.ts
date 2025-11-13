import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProxyProfile, VPNStatus, VPNStatusInfo, VPNConnectionStats } from '../types';

interface ProfileNotification {
    id: string;
    name: string;
    host?: string;
    port?: number;
    type?: string;
    isUpdate?: boolean;
}
import { storageService } from '../services';

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

    // Actions - Profile Management
    loadProfiles: () => Promise<void>;
    addProfile: (profile: ProxyProfile) => Promise<void>;
    updateProfile: (profile: ProxyProfile) => Promise<void>;
    deleteProfile: (id: string) => Promise<void>;
    selectProfile: (id: string) => Promise<void>;

    // Actions - VPN Control
    setVPNStatus: (status: VPNStatus | VPNStatusInfo) => void;
    setError: (error: string | null) => void;
    clearError: () => void;
    setProfileNotification: (notification: ProfileNotification | null) => void;
    clearProfileNotification: () => void;

    // Actions - UI State
    setLoading: (loading: boolean) => void;
}

const SELECTED_PROFILE_KEY = '@cbv_vpn_selected_profile';

export const useVPNStore = create<VPNStore>((set, get) => ({
    // Initial State
    profiles: [],
    activeProfileId: null,
    vpnStatus: 'disconnected',
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

    // Profile Management Actions
    loadProfiles: async () => {
        try {
            set({ isLoading: true, error: null });

            // Load profiles từ storage
            const profiles = await storageService.getProfiles();

            // Load selected profile từ native SharedPreferences (priority)
            // This ensures we get the profile set via ADB or native code
            let selectedProfileId: string | null = null;
            try {
                const { VPNModule } = await import('../native');
                selectedProfileId = await VPNModule.getActiveProfileId();
                console.log('📂 Loaded active profile from native:', selectedProfileId);
            } catch (nativeError) {
                console.warn('Failed to load active profile from native, falling back to AsyncStorage:', nativeError);
            }

            // Fallback to AsyncStorage if native returns null
            if (!selectedProfileId) {
                selectedProfileId = await AsyncStorage.getItem(SELECTED_PROFILE_KEY);
                console.log('📂 Loaded active profile from AsyncStorage:', selectedProfileId);
            }

            // Sync to AsyncStorage if we got it from native
            if (selectedProfileId) {
                await AsyncStorage.setItem(SELECTED_PROFILE_KEY, selectedProfileId);
            }

            set({
                profiles,
                activeProfileId: selectedProfileId,
                isLoading: false,
            });
        } catch (error) {
            console.error('Error loading profiles:', error);
            set({
                error: 'Failed to load profiles',
                isLoading: false,
            });
        }
    },

    addProfile: async (profile: ProxyProfile) => {
        try {
            set({ isLoading: true, error: null });

            await storageService.saveProfile(profile);

            const profiles = [...get().profiles, profile];
            set({ profiles, isLoading: false });
        } catch (error) {
            console.error('Error adding profile:', error);
            set({
                error: 'Failed to add profile',
                isLoading: false,
            });
            throw error;
        }
    },

    updateProfile: async (profile: ProxyProfile) => {
        try {
            set({ isLoading: true, error: null });

            await storageService.updateProfile(profile);

            const profiles = get().profiles.map(p =>
                p.id === profile.id ? profile : p
            );

            set({ profiles, isLoading: false });
        } catch (error) {
            console.error('Error updating profile:', error);
            set({
                error: 'Failed to update profile',
                isLoading: false,
            });
            throw error;
        }
    },

    deleteProfile: async (id: string) => {
        try {
            set({ isLoading: true, error: null });

            await storageService.deleteProfile(id);

            const profiles = get().profiles.filter(p => p.id !== id);
            const activeProfileId = get().activeProfileId === id ? null : get().activeProfileId;

            // Nếu profile đang active bị xóa, clear selection
            if (get().activeProfileId === id) {
                await AsyncStorage.removeItem(SELECTED_PROFILE_KEY);
            }

            set({
                profiles,
                activeProfileId,
                isLoading: false,
            });
        } catch (error) {
            console.error('Error deleting profile:', error);
            set({
                error: 'Failed to delete profile',
                isLoading: false,
            });
            throw error;
        }
    },

    selectProfile: async (id: string) => {
        try {
            set({ error: null });

            // Persist selected profile
            await AsyncStorage.setItem(SELECTED_PROFILE_KEY, id);

            set({ activeProfileId: id });
        } catch (error) {
            console.error('Error selecting profile:', error);
            set({ error: 'Failed to select profile' });
            throw error;
        }
    },

    // VPN Control Actions
    setVPNStatus: (status) => {
        if (typeof status === 'string') {
            set({
                vpnStatus: status,
                isConnected: status === 'connected',
                connectionStats: {
                    durationMillis: status === 'connected' ? get().connectionStats.durationMillis : 0,
                    bytesUp: status === 'connected' ? get().connectionStats.bytesUp : 0,
                    bytesDown: status === 'connected' ? get().connectionStats.bytesDown : 0,
                    publicIp: status === 'connected' ? get().connectionStats.publicIp : undefined,
                },
                publicIp: status === 'connected' ? get().publicIp : null,
            });
            if (status !== 'connected') {
                set({ error: status === 'error' ? get().error : null });
            } else {
                set({ error: null });
            }
            return;
        }

        const statusInfo = status as VPNStatusInfo;
        set({
            vpnStatus: statusInfo.state,
            isConnected: statusInfo.isConnected,
            connectionStats: statusInfo.stats,
            publicIp: statusInfo.stats.publicIp ?? null,
        });

        if (statusInfo.state === 'connected') {
            set({ error: null });
        }
    },

    setError: (error: string | null) => {
        set({ error });

        // Nếu có error, set status về error
        if (error) {
            set({
                vpnStatus: 'error',
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
