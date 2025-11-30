import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  PermissionsAndroid,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useVPNStore } from "../store";
import { VPNModule } from "../native";
import { CustomAlert } from "../components/CustomAlert";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../hooks/useTheme";
import type { Theme } from "../types/theme";

interface ConnectionScreenProps {
  navigation: any;
}

export const ConnectionScreen: React.FC<ConnectionScreenProps> = ({
  navigation,
}) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const {
    profiles,
    activeProfileId,
    vpnStatus,
    error,
    connectionStats,
    publicIp,
    loadProfiles,
    setVPNStatus,
    setError,
  } = useVPNStore();

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>;
  }>({
    visible: false,
    title: "",
    message: "",
    buttons: [],
  });

  const [isConnectingLocal, setIsConnectingLocal] = useState(false);

  useEffect(() => {
    const requestNotificationPermission = async () => {
      if (Platform.OS === "android" && Platform.Version >= 33) {
        try {
          const granted = await PermissionsAndroid.request(
            "android.permission.POST_NOTIFICATIONS" as any
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.warn("POST_NOTIFICATIONS permission was not granted.");
          }
        } catch (err) {
          console.warn("POST_NOTIFICATIONS permission error:", err);
        }
      }
    };

    requestNotificationPermission();
    // Force refresh to sync profiles/active selection from native (ADB flows)
    loadProfiles(true);

    console.log("🔍 Testing VPNModule...");
    VPNModule.getStatus()
      .then((status) => {
        console.log("✅ VPNModule is working! Status:", status);
      })
      .catch((error) => {
        console.error("❌ VPNModule error:", error);
      });

    VPNModule.refreshStatus();

    return () => {};
  }, []);

  useEffect(() => {
    if (!isConnectingLocal) {
      return;
    }

    if (
      vpnStatus === "connected" ||
      vpnStatus === "error" ||
      vpnStatus === "disconnected"
    ) {
      setIsConnectingLocal(false);
    }
  }, [vpnStatus, isConnectingLocal]);

  const showAlert = (
    title: string,
    message: string,
    buttons: typeof alertConfig.buttons
  ) => {
    setAlertConfig({ visible: true, title, message, buttons });
  };

  const hideAlert = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId),
    [profiles, activeProfileId]
  );

  const connectionState = useMemo(() => {
    const status = vpnStatus;
    if (status === "connected") return "connected";
    if (status === "handshaking") return "handshaking";
    if (status === "connecting" || isConnectingLocal) return "connecting";
    if (status === "error") return "error";
    return "disconnected";
  }, [vpnStatus, isConnectingLocal]);

  const isConnecting =
    connectionState === "connecting" || connectionState === "handshaking";
  const isConnected = connectionState === "connected";
  const canConnect =
    (connectionState === "disconnected" || connectionState === "error") &&
    !!activeProfile;
  const canDisconnect = isConnected || isConnecting;

  const connectButtonLabel = useMemo(() => {
    switch (connectionState) {
      case "connected":
        return "Connected";
      case "handshaking":
        return "Handshaking";
      case "connecting":
        return "Connecting";
      case "error":
        return "Connection Failed";
      default:
        return "Connect";
    }
  }, [connectionState]);

  const connectButtonSubtitle = useMemo(() => {
    const ipAddress = publicIp || connectionStats.publicIp;
    switch (connectionState) {
      case "connected":
        return ipAddress ? `IP: ${ipAddress}` : "Tunnel is active";
      case "handshaking":
        return "Negotiating secure tunnel";
      case "connecting":
        return "Requesting VPN permission";
      case "error":
        return error ? "Tap to retry" : "Tap to reconnect";
      case "disconnected":
      default:
        return activeProfile ? "Tap to start VPN" : "Select a profile first";
    }
  }, [
    connectionState,
    publicIp,
    connectionStats.publicIp,
    error,
    activeProfile,
  ]);

  const connectButtonTheme = useMemo(() => {
    switch (connectionState) {
      case "connected":
        return {
          backgroundColor: colors.vpn.connected,
          borderColor: `${colors.vpn.connected}66`,
          textColor: colors.text.inverse,
          subtitleColor: colors.text.inverse,
        };
      case "handshaking":
        return {
          backgroundColor: colors.vpn.handshaking,
          borderColor: `${colors.vpn.handshaking}66`,
          textColor: colors.text.inverse,
          subtitleColor: colors.text.inverse,
        };
      case "connecting":
        return {
          backgroundColor: colors.vpn.connecting,
          borderColor: `${colors.vpn.connecting}66`,
          textColor: colors.text.inverse,
          subtitleColor: colors.text.inverse,
        };
      case "error":
        return {
          backgroundColor: colors.vpn.error,
          borderColor: `${colors.vpn.error}66`,
          textColor: colors.text.inverse,
          subtitleColor: colors.text.inverse,
        };
      default:
        return {
          backgroundColor: colors.vpn.disconnected,
          borderColor: `${colors.vpn.disconnected}66`,
          textColor: colors.text.inverse,
          subtitleColor: colors.text.inverse,
        };
    }
  }, [connectionState, colors]);

  const lastSampleRef = useRef<{ ts: number; up: number; down: number } | null>(
    null
  );
  const [speeds, setSpeeds] = useState<{ upBps: number; downBps: number }>({
    upBps: 0,
    downBps: 0,
  });

  // Animated values for smooth speed transitions
  const animatedDownSpeed = useRef(new Animated.Value(0)).current;
  const animatedUpSpeed = useRef(new Animated.Value(0)).current;

  // Local duration state for independent timer
  const [localDuration, setLocalDuration] = useState(0);
  const durationStartRef = useRef<number | null>(null);

  // Independent speed update loop with setInterval for smooth updates
  useEffect(() => {
    if (!isConnected) {
      setSpeeds({ upBps: 0, downBps: 0 });
      lastSampleRef.current = null;

      // Animate speeds to 0 when disconnected
      Animated.timing(animatedDownSpeed, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
      Animated.timing(animatedUpSpeed, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();

      return;
    }

    // Initialize sample ref with current stats
    if (!lastSampleRef.current) {
      lastSampleRef.current = {
        ts: Date.now(),
        up: connectionStats.bytesUp,
        down: connectionStats.bytesDown,
      };
    }

    // Set up interval for smooth speed updates (500ms)
    const speedInterval = setInterval(() => {
      const now = Date.now();
      const { bytesUp, bytesDown } = connectionStats;
      const last = lastSampleRef.current;

      if (last) {
        const dt = (now - last.ts) / 1000;
        if (dt > 0) {
          const upBps = Math.max(0, (bytesUp - last.up) / dt);
          const downBps = Math.max(0, (bytesDown - last.down) / dt);

          setSpeeds({ upBps, downBps });

          // Animate speed transitions for smoothness
          Animated.timing(animatedDownSpeed, {
            toValue: downBps,
            duration: 300,
            useNativeDriver: false,
          }).start();
          Animated.timing(animatedUpSpeed, {
            toValue: upBps,
            duration: 300,
            useNativeDriver: false,
          }).start();
        }
      }

      lastSampleRef.current = { ts: now, up: bytesUp, down: bytesDown };
    }, 500);

    return () => {
      clearInterval(speedInterval);
    };
  }, [isConnected, connectionStats, animatedDownSpeed, animatedUpSpeed]);

  // Independent duration timer for smooth 1-second updates
  useEffect(() => {
    if (isConnected) {
      // Initialize duration start time when connected
      if (!durationStartRef.current) {
        durationStartRef.current = Date.now() - connectionStats.durationMillis;
      }

      // Update local duration every second
      const durationInterval = setInterval(() => {
        if (durationStartRef.current) {
          const elapsed = Date.now() - durationStartRef.current;
          setLocalDuration(elapsed);
        }
      }, 1000);

      return () => {
        clearInterval(durationInterval);
      };
    } else {
      // Reset duration when disconnected
      setLocalDuration(0);
      durationStartRef.current = null;
    }
  }, [isConnected, connectionStats.durationMillis]);

  const formatDuration = (durationMillis: number) => {
    if (durationMillis <= 0) return "00:00:00";
    const totalSeconds = Math.floor(durationMillis / 1000);
    const hours = Math.floor(totalSeconds / 3600)
      .toString()
      .padStart(2, "0");
    const minutes = Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${
      units[unitIndex]
    }`;
  };

  const formatRate = (bps: number) => {
    if (bps <= 0) return "0 B/s";
    const units = ["B/s", "KB/s", "MB/s", "GB/s"];
    let value = bps;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${
      units[unitIndex]
    }`;
  };

  const handleConnect = async () => {
    if (!activeProfile) {
      showAlert(
        "No Profile Selected",
        "Please select a profile from the profile list first.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Select Profile",
            onPress: () => navigation.navigate("Profiles"),
          },
        ]
      );
      return;
    }

    setIsConnectingLocal(true);

    try {
      if (Platform.OS === "android" && Platform.Version >= 33) {
        try {
          const granted = await PermissionsAndroid.request(
            "android.permission.POST_NOTIFICATIONS" as any
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.warn("POST_NOTIFICATIONS permission not granted");
          }
        } catch (permErr) {
          console.warn(
            "Failed to request POST_NOTIFICATIONS permission",
            permErr
          );
        }
      }

      console.log(
        "🔵 Starting VPN with profile:",
        activeProfile.id,
        activeProfile.name
      );

      await VPNModule.startVPNWithProfile(
        activeProfile.name,
        activeProfile.host,
        activeProfile.port,
        activeProfile.type,
        activeProfile.username || "",
        activeProfile.password || "",
        activeProfile.dns1,
        activeProfile.dns2
      );
      console.log("✅ VPN started successfully");
    } catch (error: any) {
      console.error("❌ VPN start error:", error);
      setError(error.message || "Failed to start VPN");
      setVPNStatus("disconnected");
      setIsConnectingLocal(false);

      let errorMessage =
        error.message || "Failed to start VPN. Please try again.";

      if (error.code === "VPN_PERMISSION_DENIED") {
        errorMessage =
          "VPN permission was denied. Please grant permission to use VPN.";
      } else if (error.code === "NO_ACTIVITY") {
        errorMessage = "Unable to request VPN permission. Please try again.";
      }

      showAlert("Connection Error", errorMessage, [{ text: "OK" }]);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsConnectingLocal(false);
      await VPNModule.stopVPN(true);
    } catch (error: any) {
      console.error("Error stopping VPN:", error);
    }
  };

  const handleSelectProfile = () => {
    navigation.navigate("Profiles");
  };

  const getStatusColor = () => {
    switch (vpnStatus) {
      case "connected":
        return colors.status.success;
      case "connecting":
      case "handshaking":
        return colors.status.warning;
      case "proxy_error":
      case "error":
        return colors.status.error;
      default:
        return colors.text.tertiary;
    }
  };

  const getStatusText = () => {
    switch (vpnStatus) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "handshaking":
        return "Handshaking...";
      case "proxy_error":
        return "⚠️ Proxy Error - No Internet";
      case "error":
        return "Error";
      default:
        return "Disconnected";
    }
  };

  const { durationMillis, bytesUp, bytesDown } = connectionStats;

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View
              style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
            />
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
          <View style={styles.durationRow}>
            <Text style={styles.durationLabel}>Duration</Text>
            <Text style={styles.durationValue}>
              {formatDuration(localDuration)}
            </Text>
          </View>
          <View style={styles.speedRow}>
            <View style={styles.speedItem}>
              <Text style={styles.speedLabel}>Download</Text>
              <Text style={styles.speedValue}>
                {formatRate(speeds.downBps)}
              </Text>
            </View>
            <View style={styles.speedItem}>
              <Text style={styles.speedLabel}>Upload</Text>
              <Text style={styles.speedValue}>{formatRate(speeds.upBps)}</Text>
            </View>
          </View>
        </View>

        {activeProfile ? (
          <View style={styles.profileInfo}>
            <Text style={styles.profileLabel}>Active Profile</Text>
            <Text style={styles.profileName}>{activeProfile.name}</Text>
            <Text style={styles.profileDetails}>
              {activeProfile.type.toUpperCase()} • {activeProfile.host}:
              {activeProfile.port}
            </Text>
            {activeProfile.username && (
              <View style={styles.profileAuth}>
                <Ionicons
                  name="shield-checkmark"
                  size={14}
                  color={colors.status.success}
                  style={styles.authIcon}
                />
                <Text style={styles.profileAuthText}>Authenticated</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.changeProfileButton}
              onPress={handleSelectProfile}
            >
              <Text style={styles.changeProfileText}>Change Profile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noProfileContainer}>
            <Text style={styles.noProfileText}>No profile selected</Text>
            <TouchableOpacity
              style={styles.selectProfileButton}
              onPress={handleSelectProfile}
            >
              <Text style={styles.selectProfileButtonText}>Select Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.connectionControl}>
          <TouchableOpacity
            style={[
              styles.connectButton,
              {
                backgroundColor: connectButtonTheme.backgroundColor,
                borderColor: connectButtonTheme.borderColor,
              },
              !canConnect && !canDisconnect && styles.connectButtonDisabled,
            ]}
            onPress={
              isConnected || isConnecting ? handleDisconnect : handleConnect
            }
            disabled={!canConnect && !canDisconnect}
            activeOpacity={0.92}
          >
            <View style={styles.connectButtonTextWrap}>
              <Text
                style={[
                  styles.connectButtonTitle,
                  { color: connectButtonTheme.textColor },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {isConnecting ? `${connectButtonLabel}…` : connectButtonLabel}
              </Text>
              <Text
                style={[
                  styles.connectButtonSubtitle,
                  { color: connectButtonTheme.subtitleColor },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {connectButtonSubtitle}
              </Text>
            </View>
            {isConnecting && (
              <ActivityIndicator
                color={connectButtonTheme.textColor}
                style={styles.connectButtonSpinner}
              />
            )}
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <View style={styles.errorHeader}>
              <Ionicons
                name="alert-circle"
                size={20}
                color={colors.status.error}
                style={styles.errorIcon}
              />
              <Text style={styles.errorTitle}>Error</Text>
            </View>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleConnect}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    scrollContent: {
      padding: theme.spacing.md,
      flexGrow: 1,
    },
    statusCard: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.md,
      shadowColor: theme.colors.shadow.color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme.colors.shadow.opacity,
      shadowRadius: 6,
      elevation: 3,
    },
    statusHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    durationRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    durationLabel: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.text.secondary,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    durationValue: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text.primary,
    },
    statusDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: theme.spacing.sm,
    },
    statusText: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
    },
    speedRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: theme.spacing.xs,
    },
    speedItem: {
      flex: 1,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
    },
    speedLabel: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.xs,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    speedValue: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text.primary,
    },
    profileInfo: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      shadowColor: theme.colors.shadow.color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme.colors.shadow.opacity,
      shadowRadius: 4,
      elevation: 3,
    },
    profileLabel: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.text.tertiary,
      marginBottom: theme.spacing.xs,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    profileName: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
    },
    profileDetails: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.xs,
    },
    profileAuth: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    authIcon: {
      marginRight: theme.spacing.xs,
    },
    profileAuthText: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.status.success,
    },
    changeProfileButton: {
      alignSelf: "flex-start",
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.background.tertiary,
    },
    changeProfileText: {
      color: theme.colors.interactive.primary,
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
    },
    noProfileContainer: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.xl,
      marginBottom: theme.spacing.lg,
      alignItems: "center",
    },
    noProfileText: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text.tertiary,
      marginBottom: theme.spacing.md,
    },
    selectProfileButton: {
      backgroundColor: theme.colors.interactive.primary,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
    },
    selectProfileButtonText: {
      color: theme.colors.text.inverse,
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
    },
    connectionControl: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
    connectButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: 999,
      minWidth: 260,
      maxWidth: 320,
      alignSelf: "center",
    },
    connectButtonDisabled: {
      opacity: 0.55,
    },
    connectButtonTextWrap: {
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    connectButtonTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
    },
    connectButtonSubtitle: {
      marginTop: theme.spacing.xs,
      fontSize: theme.typography.fontSize.sm,
      opacity: 0.75,
    },
    connectButtonSpinner: {
      marginLeft: theme.spacing.xs,
    },
    errorContainer: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginTop: theme.spacing.md,
    },
    errorHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.xs,
    },
    errorIcon: {
      marginRight: theme.spacing.xs,
    },
    errorTitle: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.status.error,
    },
    errorMessage: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.md,
    },
    retryButton: {
      backgroundColor: theme.colors.status.error,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      alignSelf: "flex-start",
    },
    retryButtonText: {
      color: theme.colors.text.inverse,
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
    },
  });
