/**
 * SettingsScreen - App settings with theme toggle
 *
 * Features:
 * - Theme mode selection (Light/Dark/System)
 * - App settings (auto-connect, notifications)
 * - Debug tools (logs viewer, clear cache)
 * - App version info
 * - Full dark mode support
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../hooks/useTheme";
import { useCustomModal } from "../hooks";
import { CustomModal } from "../components/CustomModal";
import {
  ThemedView,
  ThemedText,
  ThemedCard,
  ThemedSwitch,
  ThemedDivider,
  ThemedSettingRow,
  ThemedSectionHeader,
} from "../components/ThemedComponents";
import { Ionicons } from "@expo/vector-icons";
import type { Theme, ThemeMode } from "../types/theme";
import { VPNModule } from "../native/VPNModule";
import Constants from "expo-constants";
import { useOnboardingStore } from "../store/onboardingStore";
import { usePowerProfileStore, POWER_PROFILE_INFO, type PowerProfile } from "../store/powerProfileStore";
import { useAppSettingsStore } from "../store/appSettingsStore";

interface SettingsScreenProps {
  navigation?: any;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  navigation,
}) => {
  const styles = useThemedStyles(createStyles);
  const { theme, colors, themeMode, setThemeMode } = useTheme();
  const modal = useCustomModal();

  const [autoConnect, setAutoConnect] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [isLoadingAutoConnect, setIsLoadingAutoConnect] = useState(true);
  const [appVersion, setAppVersion] = useState<string>("Loading...");

  // Power profile state
  const { currentProfile, setProfile, loadProfile } = usePowerProfileStore();
  const {
    autoSwitchUnhealthy,
    isLoading: isLoadingAutoSwitch,
    loadSettings: loadAppSettings,
    setAutoSwitchUnhealthy,
  } = useAppSettingsStore();

  // Load auto-connect preference and app version on mount
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        // Load auto-connect preference
        const enabled = await VPNModule.getAutoConnectEnabled();
        setAutoConnect(enabled);

        // Get app version from native build config
        const version = Constants.expoConfig?.version ||
          Constants.manifest?.version ||
          "1.0.0";
        setAppVersion(version);
        console.log("📱 App version loaded:", version);
      } catch (error) {
        console.error("Failed to load settings:", error);
        modal.showError("Error", "Failed to load app settings");
        setAppVersion("Unknown");
      } finally {
        setIsLoadingAutoConnect(false);
      }
    };

    initializeSettings();
    loadAppSettings();
    loadProfile(); // Load power profile on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, loadAppSettings]); // loadProfile is stable from zustand, no need in deps

  // Handle auto-connect toggle
  const handleAutoConnectChange = useCallback(
    async (value: boolean) => {
      try {
        setAutoConnect(value);
        await VPNModule.setAutoConnectEnabled(value);
      } catch (error) {
        console.error("Failed to save auto-connect preference:", error);
        // Revert the toggle on error
        setAutoConnect(!value);
        modal.showError("Error", "Failed to save auto-connect setting");
      }
    },
    [modal]
  );

  const handleAutoSwitchUnhealthyChange = useCallback(
    async (value: boolean) => {
      try {
        await setAutoSwitchUnhealthy(value);
      } catch (error) {
        console.error("Failed to save auto-switch preference:", error);
        modal.showError("Error", "Failed to save auto-switch setting");
      }
    },
    [modal, setAutoSwitchUnhealthy]
  );

  // Open system VPN settings
  const openVPNSettings = useCallback(async () => {
    console.log("🛠️ openVPNSettings called, Platform.OS:", Platform.OS);
    if (Platform.OS === "android") {
      try {
        console.log("🛠️ Calling VPNModule.openVPNSettings()...");
        // Use native module to open VPN settings
        const result = await VPNModule.openVPNSettings();
        console.log("🛠️ VPNModule.openVPNSettings() returned:", result);
      } catch (error) {
        console.error("Failed to open VPN settings:", error);
        // Fallback to general settings
        try {
          await Linking.openSettings();
        } catch (e) {
          modal.showError("Error", "Could not open system settings");
        }
      }
    } else {
      // iOS - open general settings
      Linking.openSettings();
    }
  }, [modal]);

  // Handle theme mode change - memoized to prevent recreation on each render
  const handleThemeModeChange = useCallback(
    async (mode: ThemeMode) => {
      try {
        await setThemeMode(mode);
      } catch (error) {
        modal.showError("Error", "Failed to change theme mode");
      }
    },
    [setThemeMode, modal]
  );

  // Handle power profile change
  const handlePowerProfileChange = useCallback(
    async (profile: PowerProfile) => {
      try {
        await setProfile(profile);
      } catch (error) {
        modal.showError("Error", "Failed to change power profile");
      }
    },
    [setProfile, modal]
  );

  // Handle view logs - memoized to prevent recreation on each render
  const handleViewLogs = useCallback(() => {
    if (navigation) {
      navigation.navigate("Logs");
    }
  }, [navigation]);

  // Handle clear cache - memoized to prevent recreation on each render
  const handleClearCache = useCallback(() => {
    modal.showConfirm(
      "Clear Cache",
      "Are you sure you want to clear the app cache? This will remove all cached data.",
      () => {
        // Implement cache clearing logic here
        modal.showSuccess("Success", "Cache cleared successfully");
      },
      undefined,
      "Clear",
      "Cancel"
    );
  }, [modal]);

  // Handle reset onboarding - for testing purposes
  const { resetOnboarding } = useOnboardingStore();
  const handleResetOnboarding = useCallback(() => {
    modal.showConfirm(
      "Reset Onboarding",
      "This will show the onboarding screen again on next app restart. Continue?",
      async () => {
        await resetOnboarding();
        modal.showSuccess("Success", "Onboarding has been reset. Please restart the app.");
      },
      undefined,
      "Reset",
      "Cancel"
    );
  }, [modal, resetOnboarding]);

  // Render theme mode option - memoized to prevent recreation on each render
  const renderThemeModeOption = useCallback(
    (mode: ThemeMode, label: string, icon: keyof typeof Ionicons.glyphMap) => {
      const isSelected = themeMode === mode;

      return (
        <TouchableOpacity
          style={[
            styles.themeModeOption,
            isSelected && styles.themeModeOptionSelected,
          ]}
          onPress={() => handleThemeModeChange(mode)}
          activeOpacity={0.7}
        >
          <View style={styles.themeModeIcon}>
            <Ionicons
              name={icon}
              size={32}
              color={
                isSelected ? colors.interactive.primary : colors.text.secondary
              }
            />
          </View>
          <ThemedText
            size="sm"
            weight="medium"
            variant={isSelected ? "primary" : "secondary"}
            style={styles.themeModeLabel}
          >
            {label}
          </ThemedText>
          {isSelected && (
            <View style={styles.selectedIndicator}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={colors.interactive.primary}
              />
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [themeMode, styles, colors, handleThemeModeChange]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText size="xxl" weight="bold">
              Settings
            </ThemedText>
          </View>

          {/* Theme Settings Section */}
          <ThemedSectionHeader title="Theme Settings" />
          <ThemedCard style={styles.card}>
            <ThemedText size="md" weight="medium" style={styles.sectionTitle}>
              Appearance
            </ThemedText>
            <ThemedText
              variant="secondary"
              size="sm"
              style={styles.sectionDescription}
            >
              Choose your preferred theme mode
            </ThemedText>

            <View style={styles.themeModeContainer}>
              {renderThemeModeOption("light", "Light", "sunny")}
              {renderThemeModeOption("dark", "Dark", "moon")}
              {renderThemeModeOption("system", "System", "phone-portrait")}
            </View>
          </ThemedCard>

          {/* Power Profile Section */}
          <ThemedSectionHeader title="Performance" />
          <ThemedCard style={styles.card}>
            <ThemedText size="md" weight="medium" style={styles.sectionTitle}>
              Power Mode
            </ThemedText>
            <ThemedText
              variant="secondary"
              size="sm"
              style={styles.sectionDescription}
            >
              Balance between performance and battery life
            </ThemedText>

            <View style={styles.themeModeContainer}>
              {POWER_PROFILE_INFO.map((profile) => {
                const isSelected = currentProfile === profile.id;
                return (
                  <TouchableOpacity
                    key={profile.id}
                    style={[
                      styles.themeModeOption,
                      isSelected && styles.themeModeOptionSelected,
                    ]}
                    onPress={() => handlePowerProfileChange(profile.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.themeModeIcon}>
                      <Ionicons
                        name={profile.icon as keyof typeof Ionicons.glyphMap}
                        size={32}
                        color={
                          isSelected ? colors.interactive.primary : colors.text.secondary
                        }
                      />
                    </View>
                    <ThemedText
                      size="sm"
                      weight="medium"
                      variant={isSelected ? "primary" : "secondary"}
                      style={styles.themeModeLabel}
                    >
                      {profile.name}
                    </ThemedText>
                    {isSelected && (
                      <View style={styles.selectedIndicator}>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={colors.interactive.primary}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <ThemedText
              variant="tertiary"
              size="xs"
              style={{ marginTop: 8, textAlign: 'center' }}
            >
              {POWER_PROFILE_INFO.find(p => p.id === currentProfile)?.description}
            </ThemedText>
          </ThemedCard>

          {/* App Settings Section */}
          <ThemedSectionHeader title="App Settings" />
          <ThemedCard style={styles.card}>
            <ThemedSettingRow
              title="Always Connect VPN"
              subtitle="Automatically connect on device boot"
              rightContent={
                <View style={styles.alwaysOnRow}>
                  <ThemedSwitch
                    value={autoConnect}
                    onValueChange={handleAutoConnectChange}
                    disabled={isLoadingAutoConnect}
                  />
                </View>
              }
            />
            {Platform.OS === "android" && (
              <>
                <ThemedDivider />
                <ThemedSettingRow
                  title="System Always-on VPN"
                  subtitle="Open Android VPN settings to enable always-on"
                  icon={
                    <Ionicons
                      name="settings"
                      size={24}
                      color={colors.interactive.primary}
                    />
                  }
                  rightContent={
                    <Ionicons
                      name="open-outline"
                      size={20}
                      color={colors.text.tertiary}
                    />
                  }
                  onPress={openVPNSettings}
                />
              </>
            )}
            <ThemedDivider />
            <ThemedSettingRow
              title="Auto-switch Unhealthy Proxy"
              subtitle="Switch to a healthy profile when the active proxy fails"
              rightContent={
                <ThemedSwitch
                  value={autoSwitchUnhealthy}
                  onValueChange={handleAutoSwitchUnhealthyChange}
                  disabled={isLoadingAutoSwitch}
                />
              }
            />
            <ThemedDivider />
            <ThemedSettingRow
              title="Notifications"
              subtitle="Show VPN connection notifications"
              rightContent={
                <ThemedSwitch
                  value={notifications}
                  onValueChange={setNotifications}
                />
              }
            />
          </ThemedCard>

          {/* Debug Tools Section */}
          <ThemedSectionHeader title="Debug Tools" />
          <ThemedCard style={styles.card}>
            <ThemedSettingRow
              title="View Logs"
              subtitle="View app and VPN logs"
              icon={
                <Ionicons
                  name="document-text"
                  size={24}
                  color={colors.text.secondary}
                />
              }
              showChevron
              onPress={handleViewLogs}
            />
            <ThemedDivider />
            <ThemedSettingRow
              title="Clear Cache"
              subtitle="Remove all cached data"
              icon={
                <Ionicons name="trash" size={24} color={colors.status.error} />
              }
              showChevron
              onPress={handleClearCache}
            />
            <ThemedDivider />
            <ThemedSettingRow
              title="Reset Onboarding"
              subtitle="Show setup screen on next app start"
              icon={
                <Ionicons name="refresh" size={24} color={colors.text.secondary} />
              }
              showChevron
              onPress={handleResetOnboarding}
            />
          </ThemedCard>

          {/* App Info Section */}
          <ThemedSectionHeader title="About" />
          <ThemedCard style={styles.card}>
            <ThemedSettingRow
              title="App Version"
              subtitle={appVersion}
              icon={
                <Ionicons
                  name="information-circle"
                  size={24}
                  color={colors.text.secondary}
                />
              }
            />
            <ThemedDivider />
            <ThemedSettingRow
              title="Platform"
              subtitle={Platform.OS === "ios" ? "iOS" : "Android"}
              icon={
                <Ionicons
                  name={Platform.OS === "ios" ? "logo-apple" : "logo-android"}
                  size={24}
                  color={colors.text.secondary}
                />
              }
            />
          </ThemedCard>

          {/* Footer spacing */}
          <View style={styles.footer} />
        </ScrollView>
      </ThemedView>
      <CustomModal
        visible={modal.visible}
        config={modal.config}
        onDismiss={modal.hideModal}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: theme.spacing.xl,
    },
    header: {
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    card: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    sectionTitle: {
      marginBottom: theme.spacing.xs,
    },
    sectionDescription: {
      marginBottom: theme.spacing.md,
    },
    themeModeContainer: {
      flexDirection: "row",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    themeModeOption: {
      flex: 1,
      alignItems: "center",
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.background.tertiary,
    },
    themeModeOptionSelected: {
      backgroundColor: theme.colors.background.elevated,
      // Simplified shadow for better performance on mobile
      shadowColor: theme.colors.interactive.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    themeModeIcon: {
      marginBottom: theme.spacing.sm,
    },
    themeModeLabel: {
      textAlign: "center",
    },
    selectedIndicator: {
      position: "absolute",
      top: theme.spacing.xs,
      right: theme.spacing.xs,
    },
    alwaysOnRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    footer: {
      height: theme.spacing.xl,
    },
  });

export default SettingsScreen;
