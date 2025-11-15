/**
 * CustomModal Usage Example
 *
 * This file demonstrates how to use the CustomModal component and useCustomModal hook.
 * It can be used as a reference or integrated into an existing screen for testing.
 *
 * @module components/CustomModalExample
 */

import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { CustomModal } from "./CustomModal";
import { useCustomModal } from "../hooks/useCustomModal";
import { ThemedButton, ThemedView, ThemedText } from "./ThemedComponents";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { Theme } from "../types/theme";

/**
 * Example component demonstrating CustomModal usage
 */
export const CustomModalExample: React.FC = () => {
  const modal = useCustomModal();
  const styles = useThemedStyles(createStyles);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText size="xl" weight="bold" style={styles.title}>
          Custom Modal Examples
        </ThemedText>
        <ThemedText variant="secondary" style={styles.subtitle}>
          Test different modal types
        </ThemedText>

        {/* Success Modal */}
        <View style={styles.buttonGroup}>
          <ThemedText weight="medium" style={styles.sectionTitle}>
            Success Modal
          </ThemedText>
          <ThemedButton
            title="Show Success"
            variant="primary"
            onPress={() => {
              modal.showSuccess(
                "Success!",
                "Your profile has been saved successfully."
              );
            }}
          />
        </View>

        {/* Error Modal */}
        <View style={styles.buttonGroup}>
          <ThemedText weight="medium" style={styles.sectionTitle}>
            Error Modal
          </ThemedText>
          <ThemedButton
            title="Show Error"
            variant="secondary"
            onPress={() => {
              modal.showError(
                "Error",
                "Failed to connect to the proxy server. Please check your settings and try again."
              );
            }}
          />
        </View>

        {/* Warning Modal */}
        <View style={styles.buttonGroup}>
          <ThemedText weight="medium" style={styles.sectionTitle}>
            Warning Modal
          </ThemedText>
          <ThemedButton
            title="Show Warning"
            variant="outline"
            onPress={() => {
              modal.showWarning(
                "Warning",
                "Your cache is getting full. Consider clearing it to improve performance."
              );
            }}
          />
        </View>

        {/* Info Modal */}
        <View style={styles.buttonGroup}>
          <ThemedText weight="medium" style={styles.sectionTitle}>
            Info Modal
          </ThemedText>
          <ThemedButton
            title="Show Info"
            variant="ghost"
            onPress={() => {
              modal.showInfo(
                "Information",
                "VPN connections are encrypted and secure. Your data is protected."
              );
            }}
          />
        </View>

        {/* Confirm Modal */}
        <View style={styles.buttonGroup}>
          <ThemedText weight="medium" style={styles.sectionTitle}>
            Confirmation Modal
          </ThemedText>
          <ThemedButton
            title="Show Confirm (Delete)"
            variant="primary"
            onPress={() => {
              modal.showConfirm(
                "Delete Profile",
                "Are you sure you want to delete this profile? This action cannot be undone.",
                () => {
                  // Confirmed - show success
                  modal.showSuccess("Deleted", "Profile deleted successfully");
                },
                () => {
                  // Cancelled - show info
                  modal.showInfo("Cancelled", "Profile deletion cancelled");
                }
              );
            }}
          />
        </View>

        {/* Custom Confirm with custom text */}
        <View style={styles.buttonGroup}>
          <ThemedText weight="medium" style={styles.sectionTitle}>
            Custom Confirmation
          </ThemedText>
          <ThemedButton
            title="Clear Cache"
            variant="secondary"
            onPress={() => {
              modal.showConfirm(
                "Clear Cache",
                "This will clear all cached data. Do you want to continue?",
                () => {
                  modal.showSuccess(
                    "Cache Cleared",
                    "Cache has been cleared successfully"
                  );
                },
                undefined,
                "Clear",
                "Keep"
              );
            }}
          />
        </View>

        {/* Long message example */}
        <View style={styles.buttonGroup}>
          <ThemedText weight="medium" style={styles.sectionTitle}>
            Long Message
          </ThemedText>
          <ThemedButton
            title="Show Long Message"
            variant="outline"
            onPress={() => {
              modal.showInfo(
                "Privacy Policy",
                "This application collects and processes data to provide VPN services. Your connection data is encrypted and not stored on our servers. We do not track your browsing activity or monitor your internet usage. For more information about our privacy practices, please visit our website. By using this application, you agree to our terms of service and privacy policy. If you have any questions or concerns, please contact our support team."
              );
            }}
          />
        </View>
      </ScrollView>

      {/* The CustomModal component */}
      <CustomModal
        visible={modal.visible}
        config={modal.config}
        onDismiss={modal.hideModal}
      />
    </ThemedView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      padding: theme.spacing.md,
    },
    title: {
      marginBottom: theme.spacing.xs,
    },
    subtitle: {
      marginBottom: theme.spacing.xl,
    },
    buttonGroup: {
      marginBottom: theme.spacing.lg,
    },
    sectionTitle: {
      marginBottom: theme.spacing.sm,
    },
  });
