import { useEffect } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { VPNModule, VPNModuleEmitter } from "../native";
import { VPNStatusInfo } from "../types";
import { useVPNStore } from "../store";
import { useLogger } from "./useLogger";

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
  const { logInfo, logError, logDebug, logWarn } = useLogger({
    defaultCategory: "vpn",
  });

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
      }
    );

    // Listen for VPN permission required event
    const permissionSubscription = VPNModule.addVPNPermissionRequiredListener(
      async (payload) => {
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
};
