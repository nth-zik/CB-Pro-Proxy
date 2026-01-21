import { useEffect, useRef } from "react";
import { Linking } from "react-native";
import { v4 as uuidv4 } from "uuid";
import { VPNModule } from "../native";
import { storageService } from "../services/StorageService";
import { useVPNStore } from "../store";
import type { ProxyProfile, ProxyType } from "../types";
import { useLogger } from "./useLogger";

type DeepLinkAction =
  | "connect"
  | "disconnect"
  | "add"
  | "addAndConnect";

const normalizeAction = (rawAction: string): DeepLinkAction | null => {
  const cleaned = rawAction.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned === "connect" || cleaned === "start") {
    return "connect";
  }
  if (cleaned === "disconnect" || cleaned === "stop") {
    return "disconnect";
  }
  if (cleaned === "add" || cleaned === "addprofile") {
    return "add";
  }
  if (cleaned === "addandconnect" || cleaned === "addstart") {
    return "addAndConnect";
  }
  return null;
};

const pickFirst = (
  query: URLSearchParams,
  keys: string[]
): string | null => {
  for (const key of keys) {
    const value = query.get(key);
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return null;
};

const normalizeProxyType = (value: string | null): ProxyType => {
  const cleaned = value?.trim().toLowerCase();
  if (cleaned === "http" || cleaned === "https") {
    return "http";
  }
  if (cleaned === "socks5" || cleaned === "socks") {
    return "socks5";
  }
  return "socks5";
};

const parseDeepLink = (
  url: string
): { action: DeepLinkAction | null; query: URLSearchParams } => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "cbvproxy:") {
      return { action: null, query: new URLSearchParams() };
    }
    const rawAction = parsed.pathname?.replace(/^\/+/, "") || parsed.host || "";
    const action = normalizeAction(rawAction);
    return { action, query: parsed.searchParams };
  } catch (_error) {
    return { action: null, query: new URLSearchParams() };
  }
};

export const useDeepLinking = () => {
  const { loadProfiles, selectProfile, setVPNStatus } = useVPNStore();
  const { logInfo, logWarn, logError } = useLogger({ defaultCategory: "vpn" });
  const lastHandledUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url || lastHandledUrlRef.current === url) {
        return;
      }
      lastHandledUrlRef.current = url;

      const { action, query } = parseDeepLink(url);
      if (!action) {
        logWarn("Unsupported deep link format", undefined, { url });
        return;
      }

      if (action === "disconnect") {
        try {
          logInfo("Deep link requested VPN stop", undefined, { url });
          await VPNModule.stopVPN(true);
        } catch (error) {
          logError("Deep link failed to stop VPN", undefined, error as Error, {
            url,
          });
        }
        return;
      }

      if (action === "connect") {
        const profileId = pickFirst(query, ["profileId", "id"]);
        const profileName = pickFirst(query, ["profileName", "name"]);

        if (!profileId && !profileName) {
          logWarn("Deep link missing profile identifier", undefined, { url });
          return;
        }

        try {
          await loadProfiles(true);

          let profile = null;
          if (profileId) {
            profile = await storageService.getProfileWithCredentials(profileId);
          } else if (profileName) {
            const normalizedName = profileName.trim().toLowerCase();
            const storedProfiles = await storageService.getProfiles(true);
            const match =
              storedProfiles.find(
                (item) => item.name.trim().toLowerCase() === normalizedName
              ) || null;
            if (match) {
              profile = await storageService.getProfileWithCredentials(match.id);
            }
          }

          if (!profile) {
            logWarn("Deep link profile not found", undefined, {
              profileId,
              profileName,
              url,
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
          logInfo("Deep link started VPN", undefined, {
            profileId: profile.id,
            profileName: profile.name,
          });
        } catch (error) {
          logError("Deep link failed to start VPN", undefined, error as Error, {
            profileId,
            profileName,
            url,
          });
        }
        return;
      }

      if (action === "add" || action === "addAndConnect") {
        const host = pickFirst(query, ["host", "proxyHost", "profile_host"]);
        const portValue = pickFirst(query, [
          "port",
          "proxyPort",
          "profile_port",
        ]);
        const port = portValue ? Number(portValue) : NaN;
        if (!host || Number.isNaN(port) || port <= 0 || port > 65535) {
          logWarn("Deep link missing proxy details", undefined, {
            host,
            port: portValue,
            url,
          });
          return;
        }

        const rawProfileId = pickFirst(query, ["profileId", "id", "proxyId"]);
        const profileName = pickFirst(query, [
          "profileName",
          "name",
          "profile_name",
        ]);
        const type = normalizeProxyType(
          pickFirst(query, ["type", "protocol", "proxyType", "profile_type"])
        );
        const username = pickFirst(query, ["username", "profile_username"]);
        const password = pickFirst(query, ["password", "profile_password"]);
        const dns1 = pickFirst(query, ["dns1", "profile_dns1"]);
        const dns2 = pickFirst(query, ["dns2", "profile_dns2"]);

        const profileId = rawProfileId || uuidv4();
        const nameFromId =
          rawProfileId && rawProfileId.startsWith("proxy_")
            ? rawProfileId
            : rawProfileId
              ? `proxy_${rawProfileId}`
              : `${host}:${port}`;
        const resolvedName = profileName || nameFromId;
        const now = new Date();
        const profile: ProxyProfile = {
          id: profileId,
          name: resolvedName,
          host,
          port,
          type,
          username: username || undefined,
          password: password || undefined,
          dns1: dns1 || undefined,
          dns2: dns2 || undefined,
          createdAt: now,
          updatedAt: now,
        };

        try {
          await storageService.saveProfile(profile);
          await loadProfiles(true);
          await selectProfile(profile.id);
          logInfo("Deep link saved profile", undefined, {
            profileId: profile.id,
            profileName: profile.name,
          });

          if (action === "addAndConnect") {
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
            logInfo("Deep link started VPN", undefined, {
              profileId: profile.id,
              profileName: profile.name,
            });
          }
        } catch (error) {
          logError("Deep link failed to save profile", undefined, error as Error, {
            profileId,
            url,
          });
        }
        return;
      }

      logWarn("Unknown deep link action", undefined, { action, url });
    };

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    Linking.getInitialURL()
      .then(async (initialUrl) => {
        if (initialUrl) {
          await handleUrl(initialUrl);
          return;
        }
        const launchUrl = await VPNModule.getLaunchUrl();
        if (launchUrl) {
          await handleUrl(launchUrl);
        }
      })
      .catch(async (error) => {
        logError("Failed to read initial deep link", undefined, error as Error);
        const launchUrl = await VPNModule.getLaunchUrl();
        if (launchUrl) {
          await handleUrl(launchUrl);
        }
      });

    const launchUrlFallbackTimer = setTimeout(async () => {
      const launchUrl = await VPNModule.getLaunchUrl();
      if (launchUrl) {
        await handleUrl(launchUrl);
      }
    }, 1500);

    return () => {
      subscription.remove();
      clearTimeout(launchUrlFallbackTimer);
    };
  }, [loadProfiles, logError, logInfo, logWarn, selectProfile, setVPNStatus]);
};
