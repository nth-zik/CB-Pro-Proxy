import React, { useEffect, useMemo, useState } from "react";
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

  // Bulk selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const handleRefresh = async () => {
    try {
      await loadProfiles(true); // Force refresh to get latest from native
      // Optional: Show success message if profiles were synced
      console.log("✅ Profiles refreshed successfully");
    } catch (error) {
      console.error("❌ Failed to refresh profiles:", error);
      modal.showError("Refresh Failed", "Failed to refresh profiles from storage");
    }
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
    // If in selection mode, toggle selection instead
    if (isSelectionMode) {
      toggleSelection(profile.id);
      return;
    }
    
    try {
      await selectProfile(profile.id);
      // Navigate to Home tab instead of Connection screen
      navigation.navigate("Home");
    } catch (error) {
      modal.showError("Error", "Failed to select profile");
    }
  };

  // Bulk selection handlers
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    const allIds = new Set(profiles.map(p => p.id));
    setSelectedIds(allIds);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) {
      modal.showInfo("No Selection", "Please select profiles to delete");
      return;
    }

    const count = selectedIds.size;
    modal.showConfirm(
      "Delete Selected",
      `Are you sure you want to delete ${count} profile${count > 1 ? 's' : ''}?`,
      async () => {
        try {
          for (const id of selectedIds) {
            await deleteProfile(id);
          }
          setSelectedIds(new Set());
          setIsSelectionMode(false);
        } catch (error) {
          modal.showError("Error", "Failed to delete some profiles");
        }
      },
      undefined,
      "Delete",
      "Cancel"
    );
  };

  const handleDeleteAll = () => {
    if (profiles.length === 0) {
      modal.showInfo("No Profiles", "There are no profiles to delete");
      return;
    }

    modal.showConfirm(
      "Delete All Profiles",
      `Are you sure you want to delete ALL ${profiles.length} profile${profiles.length > 1 ? 's' : ''}? This action cannot be undone.`,
      async () => {
        try {
          for (const profile of profiles) {
            await deleteProfile(profile.id);
          }
          setSelectedIds(new Set());
          setIsSelectionMode(false);
        } catch (error) {
          modal.showError("Error", "Failed to delete some profiles");
        }
      },
      undefined,
      "Delete All",
      "Cancel"
    );
  };

  const renderProfile = ({ item }: { item: ProxyProfile }) => {
    const isActive = item.id === activeProfileId;
    const isSelected = selectedIds.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.profileItem, 
          isActive && styles.activeProfileItem,
          isSelected && styles.selectedProfileItem
        ]}
        onPress={() => handleSelectProfile(item)}
        onLongPress={() => {
          if (!isSelectionMode) {
            setIsSelectionMode(true);
            toggleSelection(item.id);
          }
        }}
      >
        <View style={styles.profileRow}>
          {/* Checkbox for selection mode */}
          {isSelectionMode && (
            <TouchableOpacity 
              style={styles.checkboxContainer}
              onPress={() => toggleSelection(item.id)}
            >
              <Ionicons
                name={isSelected ? "checkbox" : "square-outline"}
                size={24}
                color={isSelected ? colors.interactive.primary : colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
          
          <View style={[styles.profileInfo, isSelectionMode && styles.profileInfoWithCheckbox]}>
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
        </View>

        {/* Hide individual actions in selection mode */}
        {!isSelectionMode && (
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
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Normal header */}
      {!isSelectionMode ? (
        <View style={styles.header}>
          <Text style={styles.title}>VPN Profiles</Text>
          <View style={styles.headerActions}>
            {profiles.length > 0 && (
              <>
                <TouchableOpacity 
                  style={styles.headerIconButton} 
                  onPress={toggleSelectionMode}
                >
                  <Ionicons name="checkbox-outline" size={22} color={colors.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.headerIconButton} 
                  onPress={handleDeleteAll}
                >
                  <Ionicons name="trash-outline" size={22} color={colors.status.error} />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.addButton} onPress={handleAddProfile}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Selection mode header */
        <View style={styles.header}>
          <View style={styles.selectionHeader}>
            <TouchableOpacity onPress={toggleSelectionMode}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.selectionCount}>
              {selectedIds.size} selected
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.selectAllButton} 
              onPress={selectedIds.size === profiles.length ? deselectAll : selectAll}
            >
              <Text style={styles.selectAllText}>
                {selectedIds.size === profiles.length ? "Deselect All" : "Select All"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.deleteSelectedButton,
                selectedIds.size === 0 && styles.disabledButton
              ]} 
              onPress={handleDeleteSelected}
              disabled={selectedIds.size === 0}
            >
              <Ionicons name="trash" size={18} color={colors.text.inverse} />
              <Text style={styles.deleteSelectedText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={profiles}
        renderItem={renderProfile}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            colors={[colors.interactive.primary]}
            tintColor={colors.interactive.primary}
            title="Pull to refresh profiles..."
            titleColor={colors.text.secondary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="folder-open-outline"
              size={64}
              color={colors.text.tertiary}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyText}>No profiles yet</Text>
            <Text style={styles.emptySubtext}>
              Tap "Add Profile" to create your first VPN profile
            </Text>
            <Text style={styles.emptySubtext}>
              Or add via ADB and pull down to refresh
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
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    headerIconButton: {
      padding: theme.spacing.sm,
    },
    selectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    selectionCount: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text.primary,
    },
    selectAllButton: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    selectAllText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.interactive.primary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    deleteSelectedButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.status.error,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      gap: theme.spacing.xs,
    },
    deleteSelectedText: {
      color: theme.colors.text.inverse,
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
    },
    disabledButton: {
      opacity: 0.5,
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
    selectedProfileItem: {
      borderWidth: 2,
      borderColor: theme.colors.interactive.primary,
    },
    profileRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    checkboxContainer: {
      marginRight: theme.spacing.sm,
      paddingTop: 2,
    },
    profileInfo: {
      marginBottom: theme.spacing.md,
      flex: 1,
    },
    profileInfoWithCheckbox: {
      marginBottom: 0,
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
    emptyIcon: {
      marginBottom: theme.spacing.md,
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
      marginTop: theme.spacing.xs,
    },
  });
