import { useEffect, useRef } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { VPNModule, VPNModuleEmitter } from "../native";
import { VPNStatusInfo } from "../types";
import {
  useVPNStore,
  usePowerProfileStore,
  POWER_PROFILES,
  useAppSettingsStore,
} from "../store";
import { storageService } from "../services/StorageService";
import { useLogger } from "./useLogger";
import { useProxyHealthStore } from "../store/proxyHealthStore";

const AUTO_SWITCH_COOLDOWN_MS = 30000;

/**
 * Hook to listen to VPN events and update store
 */
export const useVPNEvents = () => {
  const {
    setVPNStatus,
    setError,
    loadProfiles,
    setProfileNotification,
    profiles,
    selectProfile,
  } = useVPNStore();
  const { autoSwitchUnhealthy, loadSettings: loadAppSettings } =
    useAppSettingsStore();
  const { currentProfile, loadProfile: loadPowerProfile } =
    usePowerProfileStore();
  const { logInfo, logError, logDebug, logWarn } = useLogger({
    defaultCategory: "vpn",
  });
  const lastAutoConnectRef = useRef<{ id: string; at: number } | null>(null);
  const autoSwitchInProgressRef = useRef(false);
  const lastAutoSwitchAtRef = useRef(0);

  useEffect(() => {
    loadAppSettings();
    loadPowerProfile();
  }, [loadAppSettings, loadPowerProfile]);

  useEffect(() => {
    logDebug("Setting up VPN event listeners");

    // Listen for status changes
    const statusSubscription = VPNModule.addStatusChangeListener(
      (statusInfo: VPNStatusInfo) => {
        logInfo("VPN status changed in hook", undefined, {
          state: statusInfo.state,
          isConnected: statusInfo.isConnected,
        });

        // Simple log for users
        if (statusInfo.state === "connected") {
          logInfo("✅ Proxy connected successfully");
        } else if (statusInfo.state === "connecting") {
          logInfo("🔄 Connecting proxy...");
        } else if (statusInfo.state === "disconnected") {
          logInfo("⚪ Proxy disconnected");
        } else if (statusInfo.state === "error") {
          logError("❌ Proxy connection error");
        }

        setVPNStatus(statusInfo);
      }
    );

    // Listen for errors
    const errorSubscription = VPNModule.addErrorListener((error: any) => {
      const message =
        typeof error === "string"
          ? error
          : error?.message || "Unknown VPN error";
      logError("VPN error received in hook", undefined, new Error(message));

      // Simple log for users
      logError(`❌ Proxy connection error: ${message}`);

      setError(message);
    });

    // Listen for profile updates from native module
    const profileSubscription = VPNModule.addProfilesUpdatedListener(
      async (payload) => {
        logInfo("Profile updated event received", undefined, {
          profileId: payload?.id,
          profileName: payload?.name,
          isUpdate: payload?.isUpdate,
        });
        // Force reload to ensure native profiles are synced to React Native
        await loadProfiles(true);

        setProfileNotification({
          id: payload?.id || "",
          name: payload?.name || "Unnamed proxy",
          host: payload?.host,
          port: payload?.port,
          type: payload?.type,
          isUpdate: payload?.isUpdate,
        });

        const profileId = payload?.id;
        if (!profileId) {
          return;
        }

        const now = Date.now();
        if (
          lastAutoConnectRef.current?.id === profileId &&
          now - lastAutoConnectRef.current.at < 3000
        ) {
          return;
        }
        lastAutoConnectRef.current = { id: profileId, at: now };

        try {
          const profile =
            (await storageService.getProfileWithCredentials(profileId)) || null;
          if (!profile) {
            logWarn("Auto-connect skipped: profile not found", undefined, {
              profileId,
            });
            return;
          }

          await selectProfile(profile.id);
          setVPNStatus("connecting");
          await VPNModule.startVPNWithProfile(
            profile.name,
            profile.host,
            profile.port,
            profile.type,
            profile.username || "",
            profile.password || "",
            profile.dns1,
            profile.dns2
          );
          logInfo("Auto-connecting after profile update", undefined, {
            profileId: profile.id,
            profileName: profile.name,
          });
        } catch (error) {
          logError(
            "Failed to auto-connect after profile update",
            undefined,
            error as Error,
            { profileId }
          );
        }
      }
    );

    // Listen for VPN permission required event
    const permissionSubscription = VPNModule.addVPNPermissionRequiredListener(
      async (payload) => {
        if (Platform.OS !== "android") {
          return;
        }
        logWarn("VPN permission required", undefined, {
          profileId: payload?.profileId,
          profileName: payload?.profileName,
        });

        // Reload profiles to ensure we have the latest
        await loadProfiles();

        // Auto-connect to the profile once permission is granted
        // The profile should now be in the list
        const profileId = payload?.profileId;
        if (profileId) {
          try {
            const profile = profiles.find((p) => p.id === profileId);
            if (profile) {
              logInfo("Auto-connecting after permission grant", undefined, {
                profileId,
                profileName: profile.name,
              });

              // Simple log
              logInfo(`🔄 Auto-reconnecting proxy: ${profile.name}`);

              await VPNModule.startVPNWithProfile(
                profile.name,
                profile.host,
                profile.port,
                profile.type,
                profile.username || "",
                profile.password || "",
                profile.dns1,
                profile.dns2
              );
            }
          } catch (error) {
            logError(
              "Failed to auto-connect after permission",
              undefined,
              error as Error,
              { profileId }
            );
          }
        }
      }
    );

    // Listen for active profile changed from native
    const activeProfileSubscription = VPNModule.addActiveProfileChangedListener(
      async (payload) => {
        logInfo("Active profile changed from native", undefined, {
          profileId: payload?.profileId,
          profileName: payload?.profileName,
        });
        const profileId = payload?.profileId;
        if (profileId) {
          // Force reload to ensure profile exists before selecting
          await loadProfiles(true);
          // Update the active profile in store
          await selectProfile(profileId);
          logDebug("Active profile updated in store", undefined, { profileId });
        }
      }
    );

    const notifPermissionSubscription = VPNModuleEmitter.addListener(
      "notificationPermissionRequired",
      async () => {
        try {
          logWarn("Notification permission required");
          if (Platform.OS === "android") {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            if (granted === PermissionsAndroid.RESULTS.GRANTED) {
              logInfo("Notification permission granted");
              await loadProfiles();
              const activeId = await VPNModule.getActiveProfileId();
              if (activeId) {
                const profile = profiles.find((p) => p.id === activeId);
                if (profile) {
                  logInfo(
                    "Restarting VPN after notification permission",
                    undefined,
                    { profileId: activeId }
                  );
                  await VPNModule.startVPNWithProfile(
                    profile.name,
                    profile.host,
                    profile.port,
                    profile.type,
                    profile.username || "",
                    profile.password || "",
                    profile.dns1,
                    profile.dns2
                  );
                }
              }
            } else {
              logWarn("Notification permission denied");
            }
          }
        } catch (e) {
          logError(
            "Failed to request notification permission",
            undefined,
            e as Error
          );
        }
      }
    );

    // Cleanup subscriptions
    return () => {
      logDebug("Cleaning up VPN event listeners");
      statusSubscription.remove();
      errorSubscription.remove();
      profileSubscription.remove();
      permissionSubscription.remove();
      activeProfileSubscription.remove();
      notifPermissionSubscription.remove();
    };
  }, [
    setVPNStatus,
    setError,
    loadProfiles,
    setProfileNotification,
    selectProfile,
    logInfo,
    logError,
    logDebug,
    logWarn,
  ]);

  useEffect(() => {
    if (!autoSwitchUnhealthy) {
      return;
    }

    let cancelled = false;
    const intervalMs =
      POWER_PROFILES[currentProfile]?.healthCheckIntervalMs || 60000;

    const runCheck = async () => {
      if (cancelled || autoSwitchInProgressRef.current) {
        return;
      }

      autoSwitchInProgressRef.current = true;
      try {
        if (cancelled) {
          return;
        }

        const now = Date.now();
        if (now - lastAutoSwitchAtRef.current < AUTO_SWITCH_COOLDOWN_MS) {
          return;
        }

        const vpnState = useVPNStore.getState();
        if (vpnState.vpnStatus !== "connected") {
          return;
        }

        if (!vpnState.activeProfileId) {
          return;
        }

        let activeProfile =
          vpnState.profiles.find((p) => p.id === vpnState.activeProfileId) ||
          null;

        if (!activeProfile) {
          await vpnState.loadProfiles(true);
          const refreshed = useVPNStore.getState();
          activeProfile =
            refreshed.profiles.find(
              (p) => p.id === refreshed.activeProfileId
            ) || null;
        }

        if (!activeProfile) {
          return;
        }

        const activeWithCredentials =
          (await storageService.getProfileWithCredentials(activeProfile.id)) ||
          activeProfile;

        const healthStore = useProxyHealthStore.getState();
        const activeHealth = await healthStore.checkProfileHealth(
          activeWithCredentials
        );

        if (activeHealth.status !== "fail") {
          return;
        }

        const candidates = useVPNStore
          .getState()
          .profiles.filter((p) => p.id !== activeProfile.id);

        if (candidates.length === 0) {
          logWarn("Auto-switch skipped: no alternative profiles", undefined, {
            profileId: activeProfile.id,
          });
          return;
        }

        for (const candidate of candidates) {
          if (cancelled) {
            return;
          }

          const candidateWithCredentials =
            (await storageService.getProfileWithCredentials(candidate.id)) ||
            candidate;

          const candidateHealth = await healthStore.checkProfileHealth(
            candidateWithCredentials
          );

          if (candidateHealth.status === "ok") {
            const vpnActions = useVPNStore.getState();
            await vpnActions.selectProfile(candidateWithCredentials.id);
            vpnActions.setVPNStatus("connecting");
            await VPNModule.startVPNWithProfile(
              candidateWithCredentials.name,
              candidateWithCredentials.host,
              candidateWithCredentials.port,
              candidateWithCredentials.type,
              candidateWithCredentials.username || "",
              candidateWithCredentials.password || "",
              candidateWithCredentials.dns1,
              candidateWithCredentials.dns2
            );
            lastAutoSwitchAtRef.current = Date.now();
            logWarn("Auto-switched to healthy proxy", undefined, {
              fromProfileId: activeProfile.id,
              toProfileId: candidateWithCredentials.id,
            });
            return;
          }
        }

        logWarn("Auto-switch skipped: no healthy profiles available", undefined, {
          profileId: activeProfile.id,
        });
      } catch (error) {
        logError("Auto-switch failed", undefined, error as Error);
      } finally {
        autoSwitchInProgressRef.current = false;
      }
    };

    runCheck();
    const intervalId = setInterval(runCheck, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [autoSwitchUnhealthy, currentProfile, logWarn, logError]);
};
