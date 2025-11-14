import { useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { VPNModule, VPNModuleEmitter } from '../native';
import { VPNStatusInfo } from '../types';
import { useVPNStore } from '../store';

/**
 * Hook to listen to VPN events and update store
 */
export const useVPNEvents = () => {
    const { setVPNStatus, setError, loadProfiles, setProfileNotification, profiles, selectProfile } = useVPNStore();

    useEffect(() => {
        // Listen for status changes
        const statusSubscription = VPNModule.addStatusChangeListener(
            (statusInfo: VPNStatusInfo) => {
                console.log('VPN Status changed:', statusInfo);
                setVPNStatus(statusInfo);
            }
        );

        // Listen for errors
        const errorSubscription = VPNModule.addErrorListener((error: any) => {
            const message = typeof error === 'string' ? error : (error?.message || 'Unknown VPN error');
            console.error('VPN Error:', message);
            setError(message);
        });

        // Listen for profile updates from native module
        const profileSubscription = VPNModule.addProfilesUpdatedListener(async (payload) => {
            console.log('📡 Received profilesUpdated event:', payload);
            await loadProfiles();

            setProfileNotification({
                id: payload?.id || '',
                name: payload?.name || 'Unnamed proxy',
                host: payload?.host,
                port: payload?.port,
                type: payload?.type,
                isUpdate: payload?.isUpdate,
            });
        });

        // Listen for VPN permission required event
        const permissionSubscription = VPNModule.addVPNPermissionRequiredListener(async (payload) => {
            console.log('📡 VPN permission required for profile:', payload);
            
            // Reload profiles to ensure we have the latest
            await loadProfiles();
            
            // Auto-connect to the profile once permission is granted
            // The profile should now be in the list
            const profileId = payload?.profileId;
            if (profileId) {
                try {
                    const profile = profiles.find(p => p.id === profileId);
                    if (profile) {
                        console.log('🔄 Auto-connecting to profile after permission grant:', profile.name);
                        await VPNModule.startVPNWithProfile(
                            profile.name,
                            profile.host,
                            profile.port,
                            profile.type,
                            profile.username || '',
                            profile.password || '',
                            profile.dns1,
                            profile.dns2
                        );
                    }
                } catch (error) {
                    console.error('Failed to auto-connect after permission:', error);
                }
            }
        });

        // Listen for active profile changed from native
        const activeProfileSubscription = VPNModule.addActiveProfileChangedListener(async (payload) => {
            console.log('📡 Active profile changed from native:', payload);
            const profileId = payload?.profileId;
            if (profileId) {
                // Update the active profile in store
                await selectProfile(profileId);
                console.log('✅ Active profile updated in store:', profileId);
            }
        });

        const notifPermissionSubscription = VPNModuleEmitter.addListener('notificationPermissionRequired', async () => {
            try {
                if (Platform.OS === 'android') {
                    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
                    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                        await loadProfiles();
                        const activeId = await VPNModule.getActiveProfileId();
                        if (activeId) {
                            const profile = profiles.find(p => p.id === activeId);
                            if (profile) {
                                await VPNModule.startVPNWithProfile(
                                    profile.name,
                                    profile.host,
                                    profile.port,
                                    profile.type,
                                    profile.username || '',
                                    profile.password || '',
                                    profile.dns1,
                                    profile.dns2
                                );
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to request notification permission:', e);
            }
        });

        // Cleanup subscriptions
        return () => {
            statusSubscription.remove();
            errorSubscription.remove();
            profileSubscription.remove();
            permissionSubscription.remove();
            activeProfileSubscription.remove();
            notifPermissionSubscription.remove();
        };
    }, [setVPNStatus, setError, loadProfiles, setProfileNotification, profiles, selectProfile]);
};
