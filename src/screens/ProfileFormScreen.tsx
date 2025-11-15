import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useVPNStore } from "../store";
import {
  ProxyProfile,
  ProxyType,
  validateProxyProfile,
  sanitizeProfileInput,
} from "../types";
import { useTheme } from "../hooks/useTheme";
import { useCustomModal } from "../hooks";
import { CustomModal } from "../components/CustomModal";

interface ProfileFormScreenProps {
  navigation: any;
  route: any;
}

export const ProfileFormScreen: React.FC<ProfileFormScreenProps> = ({
  navigation,
  route,
}) => {
  const existingProfile = route.params?.profile as ProxyProfile | undefined;
  const isEditing = !!existingProfile;

  const { addProfile, updateProfile } = useVPNStore();
  const { theme, colors } = useTheme();
  const modal = useCustomModal();

  const [name, setName] = useState(existingProfile?.name || "");
  const [host, setHost] = useState(existingProfile?.host || "");
  const [port, setPort] = useState(existingProfile?.port?.toString() || "");
  const [type, setType] = useState<ProxyType>(
    existingProfile?.type || "socks5"
  );
  const [username, setUsername] = useState(existingProfile?.username || "");
  const [password, setPassword] = useState(existingProfile?.password || "");
  const [dns1, setDns1] = useState(existingProfile?.dns1 || "1.1.1.1");
  const [dns2, setDns2] = useState(existingProfile?.dns2 || "8.8.8.8");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [quickImport, setQuickImport] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Memoize styles based on theme
  const styles = useMemo(() => createStyles(theme, colors), [theme, colors]);

  const parseProxyString = (proxyString: string) => {
    // Format: host:port:username:password
    const parts = proxyString.trim().split(":");

    if (parts.length < 2) {
      modal.showError(
        "Invalid Format",
        "Proxy string must be in format: host:port:username:password"
      );
      return;
    }

    const [parsedHost, parsedPort, parsedUsername, parsedPassword] = parts;

    setHost(parsedHost);
    setPort(parsedPort);

    if (parsedUsername) {
      setUsername(parsedUsername);
    }

    if (parsedPassword) {
      setPassword(parsedPassword);
    }

    // Auto-generate name if empty
    if (!name) {
      setName(`Proxy ${parsedHost}`);
    }

    setQuickImport("");
    modal.showSuccess("Success", "Proxy details imported successfully!");
  };

  const handleQuickImport = () => {
    if (!quickImport.trim()) {
      modal.showError("Error", "Please enter a proxy string");
      return;
    }
    parseProxyString(quickImport);
  };

  const handleScanQR = async () => {
    if (!permission) {
      return;
    }

    if (!permission.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        modal.showWarning(
          "Permission Required",
          "Camera permission is required to scan QR codes"
        );
        return;
      }
    }

    setShowScanner(true);
  };

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    setShowScanner(false);
    parseProxyString(data);
  };

  const handleSave = async () => {
    // Sanitize input
    const sanitized = sanitizeProfileInput({
      name,
      host,
      port: parseInt(port, 10),
      type,
      username,
      password,
      dns1,
      dns2,
    });

    // Validate
    const validation = validateProxyProfile(sanitized);
    if (!validation.valid) {
      modal.showError("Validation Error", validation.errors.join("\n"));
      return;
    }

    setIsSaving(true);

    try {
      const profile: ProxyProfile = {
        id: existingProfile?.id || `profile_${Date.now()}`,
        name: sanitized.name!,
        host: sanitized.host!,
        port: sanitized.port!,
        type: sanitized.type!,
        username: sanitized.username,
        password: sanitized.password,
        dns1: sanitized.dns1,
        dns2: sanitized.dns2,
        createdAt: existingProfile?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      if (isEditing) {
        await updateProfile(profile);
        modal.showSuccess("Success", "Profile updated successfully");
      } else {
        await addProfile(profile);
        modal.showSuccess("Success", "Profile created successfully");
      }

      navigation.goBack();
    } catch (error) {
      modal.showError("Error", "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.form}>
            {/* Quick Import Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Import</Text>
              <Text style={styles.helpText}>
                Paste proxy string in format: host:port:username:password
              </Text>
              <View style={styles.quickImportContainer}>
                <TextInput
                  style={[styles.input, styles.quickImportInput]}
                  value={quickImport}
                  onChangeText={setQuickImport}
                  placeholder="host:port:username:password"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.importButton}
                  onPress={handleQuickImport}
                  activeOpacity={0.7}
                >
                  <Text style={styles.importButtonText}>Import</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.scanButton}
                onPress={handleScanQR}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="qr-code-outline"
                  size={20}
                  color={colors.text.inverse}
                  style={styles.scanIcon}
                />
                <Text style={styles.scanButtonText}>Scan QR Code</Text>
              </TouchableOpacity>
            </View>

            {/* Profile Information Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile Information</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Profile Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="My VPN Profile"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Proxy Host *</Text>
                <TextInput
                  style={styles.input}
                  value={host}
                  onChangeText={setHost}
                  placeholder="proxy.example.com or 192.168.1.1"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Proxy Port * (1-65535)</Text>
                <TextInput
                  style={styles.input}
                  value={port}
                  onChangeText={setPort}
                  placeholder="1080"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Proxy Type *</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      type === "socks5" && styles.typeButtonActive,
                    ]}
                    onPress={() => setType("socks5")}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        type === "socks5" && styles.typeButtonTextActive,
                      ]}
                    >
                      SOCKS5
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      type === "http" && styles.typeButtonActive,
                    ]}
                    onPress={() => setType("http")}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        type === "http" && styles.typeButtonTextActive,
                      ]}
                    >
                      HTTP
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Authentication Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Authentication (Optional)</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="username"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="password"
                    placeholderTextColor={colors.text.tertiary}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.showPasswordButton}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={24}
                      color={colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* DNS Settings Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DNS Settings</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Primary DNS</Text>
                <TextInput
                  style={styles.input}
                  value={dns1}
                  onChangeText={setDns1}
                  placeholder="1.1.1.1"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Secondary DNS</Text>
                <TextInput
                  style={styles.input}
                  value={dns2}
                  onChangeText={setDns2}
                  placeholder="8.8.8.8"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            {/* Spacer for sticky buttons */}
            <View style={styles.bottomSpacer} />
          </View>
        </ScrollView>

        {/* Sticky Action Buttons */}
        <View style={styles.stickyActions}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
            disabled={isSaving}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              styles.saveButton,
              isSaving && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.7}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? "Saving..." : isEditing ? "Update" : "Create"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* QR Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <SafeAreaView style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan QR Code</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowScanner(false)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="close"
                size={24}
                color={colors.text.inverse}
                style={styles.closeIcon}
              />
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          />
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerInstructions}>
              Point camera at QR code containing proxy details
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
      <CustomModal
        visible={modal.visible}
        config={modal.config}
        onDismiss={modal.hideModal}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any, colors: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    container: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: theme.spacing.xl,
    },
    form: {
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
    section: {
      marginBottom: theme.spacing.lg,
    },
    sectionTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      color: colors.text.primary,
      marginBottom: theme.spacing.md,
      letterSpacing: 0.3,
    },
    helpText: {
      fontSize: theme.typography.fontSize.xs,
      color: colors.text.secondary,
      marginBottom: theme.spacing.sm,
      fontStyle: "italic",
      lineHeight: 18,
    },
    quickImportContainer: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    quickImportInput: {
      flex: 1,
    },
    importButton: {
      backgroundColor: colors.status.success,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: colors.shadow.color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: colors.shadow.opacity,
      shadowRadius: 4,
      elevation: 3,
    },
    importButtonText: {
      color: colors.text.inverse,
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.bold,
    },
    scanButton: {
      backgroundColor: colors.interactive.primary,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.shadow.color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: colors.shadow.opacity,
      shadowRadius: 4,
      elevation: 3,
    },
    scanIcon: {
      marginRight: theme.spacing.sm,
    },
    scanButtonText: {
      color: colors.text.inverse,
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: 0.5,
    },
    inputGroup: {
      marginBottom: theme.spacing.md,
    },
    label: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
      color: colors.text.secondary,
      marginBottom: theme.spacing.sm,
      letterSpacing: 0.2,
    },
    input: {
      backgroundColor: colors.background.tertiary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      fontSize: theme.typography.fontSize.md,
      color: colors.text.primary,
      shadowColor: colors.shadow.color,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: colors.shadow.opacity * 0.5,
      shadowRadius: 2,
      elevation: 1,
    },
    typeSelector: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },
    typeButton: {
      flex: 1,
      backgroundColor: colors.background.secondary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      alignItems: "center",
      shadowColor: colors.shadow.color,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: colors.shadow.opacity * 0.5,
      shadowRadius: 2,
      elevation: 1,
    },
    typeButtonActive: {
      backgroundColor: colors.interactive.primary,
      shadowColor: colors.interactive.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    typeButtonText: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.bold,
      color: colors.text.secondary,
      letterSpacing: 0.5,
    },
    typeButtonTextActive: {
      color: colors.text.inverse,
    },
    passwordContainer: {
      position: "relative",
    },
    passwordInput: {
      paddingRight: 56,
    },
    showPasswordButton: {
      position: "absolute",
      right: theme.spacing.md,
      top: theme.spacing.md,
      padding: theme.spacing.xs,
    },
    bottomSpacer: {
      height: 80, // Space for sticky buttons
    },
    stickyActions: {
      flexDirection: "row",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      backgroundColor: colors.background.elevated,
      shadowColor: colors.shadow.color,
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: colors.shadow.opacity * 2,
      shadowRadius: 8,
      elevation: 8,
    },
    button: {
      flex: 1,
      paddingVertical: theme.spacing.md + 2,
      borderRadius: theme.borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.shadow.color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: colors.shadow.opacity,
      shadowRadius: 4,
      elevation: 3,
    },
    cancelButton: {
      backgroundColor: colors.background.secondary,
    },
    cancelButtonText: {
      color: colors.text.secondary,
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: 0.5,
    },
    saveButton: {
      backgroundColor: colors.interactive.primary,
    },
    saveButtonDisabled: {
      backgroundColor: colors.interactive.disabled,
      opacity: 0.6,
    },
    saveButtonText: {
      color: colors.text.inverse,
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: 0.5,
    },
    // Scanner Modal Styles
    scannerContainer: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    scannerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.md,
      backgroundColor: colors.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.primary,
    },
    scannerTitle: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      color: colors.text.primary,
    },
    closeButton: {
      padding: theme.spacing.sm,
      flexDirection: "row",
      alignItems: "center",
    },
    closeIcon: {
      marginRight: theme.spacing.xs,
    },
    closeButtonText: {
      color: colors.text.primary,
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.bold,
    },
    camera: {
      flex: 1,
    },
    scannerOverlay: {
      position: "absolute",
      bottom: 40,
      left: 0,
      right: 0,
      alignItems: "center",
      padding: theme.spacing.lg,
    },
    scannerInstructions: {
      color: colors.text.inverse,
      fontSize: theme.typography.fontSize.md,
      textAlign: "center",
      backgroundColor: colors.background.secondary,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      overflow: "hidden",
      opacity: 0.95,
    },
  });
