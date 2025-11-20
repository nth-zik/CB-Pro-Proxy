import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useVPNStore } from "../store";
import { ProxyProfile } from "../types";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../hooks/useTheme";
import { useCustomModal } from "../hooks";
import { CustomModal } from "../components/CustomModal";
import type { Theme } from "../types/theme";

interface ProfileListScreenProps {
  navigation: any;
}

export const ProfileListScreen: React.FC<ProfileListScreenProps> = ({
  navigation,
}) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const modal = useCustomModal();

  const {
    profiles,
    activeProfileId,
    isLoading,
    loadProfiles,
    deleteProfile,
    selectProfile,
  } = useVPNStore();

  useEffect(() => {
    loadProfiles();
  }, []);

  // Reload profiles when screen comes into focus (e.g., after ADB adds a profile)
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      loadProfiles(true); // Force refresh to get latest from native
    });

    return unsubscribe;
  }, [navigation, loadProfiles]);

  const handleRefresh = () => {
    loadProfiles(true); // Force refresh to get latest from native
  };

  const handleAddProfile = () => {
    navigation.navigate("ProfileForm");
  };

  const handleEditProfile = (profile: ProxyProfile) => {
    navigation.navigate("ProfileForm", { profile });
  };

  const handleDeleteProfile = (profile: ProxyProfile) => {
    modal.showConfirm(
      "Delete Profile",
      `Are you sure you want to delete "${profile.name}"?`,
      async () => {
        try {
          await deleteProfile(profile.id);
        } catch (error) {
          modal.showError("Error", "Failed to delete profile");
        }
      },
      undefined,
      "Delete",
      "Cancel"
    );
  };

  const handleSelectProfile = async (profile: ProxyProfile) => {
    try {
      await selectProfile(profile.id);
      // Navigate to Home tab instead of Connection screen
      navigation.navigate("Home");
    } catch (error) {
      modal.showError("Error", "Failed to select profile");
    }
  };

  const renderProfile = ({ item }: { item: ProxyProfile }) => {
    const isActive = item.id === activeProfileId;

    return (
      <TouchableOpacity
        style={[styles.profileItem, isActive && styles.activeProfileItem]}
        onPress={() => handleSelectProfile(item)}
      >
        <View style={styles.profileInfo}>
          <View style={styles.profileHeader}>
            <Text style={styles.profileName}>{item.name}</Text>
            {isActive && (
              <View style={styles.activeIndicator}>
                <Text style={styles.activeText}>ACTIVE</Text>
              </View>
            )}
          </View>
          <Text style={styles.profileDetails}>
            {item.type.toUpperCase()} • {item.host}:{item.port}
          </Text>
          {item.username && (
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
        </View>

        <View style={styles.profileActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditProfile(item)}
          >
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteProfile(item)}
          >
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>VPN Profiles</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddProfile}>
          <Text style={styles.addButtonText}>+ Add Profile</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={profiles}
        renderItem={renderProfile}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No profiles yet</Text>
            <Text style={styles.emptySubtext}>
              Tap "Add Profile" to create your first VPN profile
            </Text>
          </View>
        }
      />
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
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.md,
      backgroundColor: theme.colors.background.secondary,
    },
    title: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
    },
    addButton: {
      backgroundColor: theme.colors.interactive.primary,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
    },
    addButtonText: {
      color: theme.colors.text.inverse,
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
    },
    listContent: {
      padding: theme.spacing.md,
    },
    profileItem: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      shadowColor: theme.colors.shadow.color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme.colors.shadow.opacity,
      shadowRadius: 4,
      elevation: 3,
    },
    activeProfileItem: {
      shadowColor: theme.colors.status.success,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
    profileInfo: {
      marginBottom: theme.spacing.md,
    },
    profileHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.xs,
    },
    profileName: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text.primary,
      flex: 1,
    },
    activeIndicator: {
      backgroundColor: theme.colors.status.success,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
    },
    activeText: {
      color: theme.colors.text.inverse,
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
    },
    profileDetails: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.xs,
    },
    profileAuth: {
      flexDirection: "row",
      alignItems: "center",
    },
    authIcon: {
      marginRight: theme.spacing.xs,
    },
    profileAuthText: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.status.success,
    },
    profileActions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    actionButton: {
      flex: 1,
      backgroundColor: theme.colors.interactive.primary,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      alignItems: "center",
    },
    actionButtonText: {
      color: theme.colors.text.inverse,
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
    },
    deleteButton: {
      backgroundColor: theme.colors.background.tertiary,
      borderWidth: 1,
      borderColor: theme.colors.border.primary,
    },
    deleteButtonText: {
      color: theme.colors.status.error,
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
    },
    emptyText: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text.tertiary,
      marginBottom: theme.spacing.sm,
    },
    emptySubtext: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.tertiary,
      textAlign: "center",
    },
  });
