import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useVPNStore } from "../store";
import { ProxyProfile } from "../types";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../hooks/useTheme";
import { useCustomModal } from "../hooks";
import { CustomModal } from "../components/CustomModal";
import { ImportProfileModal } from "../components/ImportProfileModal";
import { HealthCheckModal } from "../components/HealthCheckModal";
import { ProfileListItem } from "../components/ProfileListItem";
import { HealthCheckToast } from "../components/HealthCheckToast";
import { ProxySourcesModal } from "../components/ProxySourcesModal";
import { useProxyHealthStore } from "../store/proxyHealthStore";
import { storageService } from "../services";
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

  // Use selectors to avoid re-rendering the entire list when health updates
  const checkAll = useProxyHealthStore((s) => s.checkAll);
  const checkProfileHealth = useProxyHealthStore((s) => s.checkProfileHealth);
  const enqueueCheck = useProxyHealthStore((s) => s.enqueueCheck);

  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [isHealthCheckModalVisible, setIsHealthCheckModalVisible] =
    useState(false);
  const [isProxySourcesModalVisible, setIsProxySourcesModalVisible] =
    useState(false);

  // Bulk selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete progress state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({
    current: 0,
    total: 0,
  });
  const [deleteResult, setDeleteResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);
  const cancelDeleteRef = useRef(false);

  const {
    profiles,
    activeProfileId,
    loadProfiles,
    deleteProfile,
    bulkDeleteProfiles,
    selectProfile,
  } = useVPNStore();

  // Local state for refresh control to avoid relying solely on store's isLoading
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tag filtering
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    profiles.forEach((p) => {
      p.tags?.forEach((t) => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [profiles]);

  const [query, setQuery] = useState("");
  const filteredProfiles = useMemo(() => {
    let result = profiles;

    // Filter by search query
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.host.toLowerCase().includes(q),
      );
    }

    // Filter by tag
    if (selectedTag) {
      result = result.filter((p) => p.tags?.includes(selectedTag));
    }

    // Sort active profile to top
    if (activeProfileId) {
      // Create a copy to avoid mutating state
      result = [...result].sort((a, b) => {
        if (a.id === activeProfileId) return -1;
        if (b.id === activeProfileId) return 1;
        return 0;
      });
    }

    return result;
  }, [profiles, query, selectedTag, activeProfileId]);

  useEffect(() => {
    loadProfiles();
  }, []);

  // Reload profiles when screen comes into focus (e.g., after ADB adds a profile)
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      // Only refresh if not loaded, or rely on initial load.
      // Removing force refresh to prevent infinite loading loops/slowness
      loadProfiles(false);

      // Reset selection mode when entering screen to avoid being stuck
      setIsSelectionMode(false);
      setSelectedIds(new Set());
    });

    return unsubscribe;
  }, [navigation, loadProfiles]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      // Wrap loadProfiles in a timeout race to ensure spinner always stops
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Refresh timed out")), 10000),
      );

      await Promise.race([
        loadProfiles(true), // Force refresh to get latest from native
        timeoutPromise,
      ]);

      // Trigger health check for all visible/filtered profiles
      // We don't await this to allow the UI to be responsive,
      // or we can await if we want the spinner to stay until checks are done.
      // Given user feedback, let's run it but not block the refresh spinner indefinitely
      // or maybe we SHOULD block it so they know it's checking?
      // Start check in background, don't block UI/Spinner
      checkAll(filteredProfiles).catch((err) => {
        const errorMsg =
          typeof err === "object" ? JSON.stringify(err) : String(err);
        console.error("Health check failed", errorMsg);
      });

      // Optional: Show success message if profiles were synced
      console.log("✅ Profiles refreshed successfully");
    } catch (error: any) {
      const errorMsg =
        error?.message ||
        (typeof error === "object" ? JSON.stringify(error) : String(error));
      console.error("❌ Failed to refresh profiles:", errorMsg);
      modal.showError(
        "Refresh Failed",
        `Failed to refresh profiles: ${errorMsg}`,
      );
    } finally {
      setIsRefreshing(false);
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
      "Cancel",
    );
  };

  const handleSelectProfile = async (profile: ProxyProfile) => {
    // If in selection mode, toggle selection instead
    if (isSelectionMode) {
      toggleSelection(profile.id);
      return;
    }

    try {
      // Optimistically update UI via store immediately
      // The store action already handles AsyncStorage, but we want to ensure
      // navigation feels responsive.
      await selectProfile(profile.id);

      // Navigate to Home tab instead of Connection screen
      navigation.navigate("Home");
    } catch (error) {
      modal.showError("Error", "Failed to select profile");
    }
  };

  const handleCheckProfile = async (profile: ProxyProfile) => {
    // Force check single profile
    await checkProfileHealth(profile);
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
    if (filteredProfiles.length === 0) return;
    const allIds = new Set(filteredProfiles.map((p) => p.id));
    setSelectedIds(allIds);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const selectUnhealthy = () => {
    const unhealthyIds = new Set<string>();
    // Use getState() to avoid subscribing to health updates in this component
    const currentHealth = useProxyHealthStore.getState().health;

    filteredProfiles.forEach((p) => {
      const h = currentHealth[p.id];
      if (h && h.status === "fail") {
        unhealthyIds.add(p.id);
      }
    });

    if (unhealthyIds.size === 0) {
      modal.showInfo(
        "No Unhealthy Profiles",
        "No profiles with 'fail' status found in current list.",
      );
      return;
    }

    setSelectedIds(unhealthyIds);
    modal.showInfo(
      "Selected Unhealthy",
      `Selected ${unhealthyIds.size} unhealthy profiles.`,
    );
  };

  const handleDeleteUnhealthy = () => {
    const unhealthyIds = new Set<string>();
    const currentHealth = useProxyHealthStore.getState().health;

    filteredProfiles.forEach((p) => {
      const h = currentHealth[p.id];
      if (h && h.status === "fail") {
        unhealthyIds.add(p.id);
      }
    });

    if (unhealthyIds.size === 0) {
      modal.showInfo(
        "No Unhealthy Profiles",
        "No profiles with 'fail' status found in current list.",
      );
      return;
    }

    const count = unhealthyIds.size;
    modal.showConfirm(
      "Delete Unhealthy Profiles",
      `Are you sure you want to delete ${count} unhealthy profile${
        count > 1 ? "s" : ""
      }?`,
      () => {
        const idsArray = Array.from(unhealthyIds);
        handleBulkDeleteWithProgress(idsArray);
      },
      undefined,
      "Delete",
      "Cancel",
    );
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) {
      modal.showInfo("No Selection", "Please select profiles to delete");
      return;
    }

    const count = selectedIds.size;
    modal.showConfirm(
      "Delete Selected",
      `Are you sure you want to delete ${count} profile${
        count > 1 ? "s" : ""
      }?`,
      () => {
        const idsArray = Array.from(selectedIds);
        handleBulkDeleteWithProgress(idsArray);
      },
      undefined,
      "Delete",
      "Cancel",
    );
  };

  const handleDeleteAll = () => {
    if (profiles.length === 0) {
      modal.showInfo("No Profiles", "There are no profiles to delete");
      return;
    }

    modal.showConfirm(
      "Delete All Profiles",
      `Are you sure you want to delete ALL ${profiles.length} profile${
        profiles.length > 1 ? "s" : ""
      }? This action cannot be undone.`,
      () => {
        const allIds = profiles.map((p) => p.id);
        handleBulkDeleteWithProgress(allIds);
      },
      undefined,
      "Delete All",
      "Cancel",
    );
  };

  const handleBulkDeleteWithProgress = async (ids: string[]) => {
    // Reset state
    setIsDeleting(true);
    setDeleteProgress({ current: 0, total: ids.length });
    setDeleteResult(null);
    cancelDeleteRef.current = false;

    let successCount = 0;
    let failCount = 0;

    // Delete profiles one by one with progress
    for (let i = 0; i < ids.length; i++) {
      if (cancelDeleteRef.current) {
        break;
      }

      try {
        await storageService.deleteProfile(ids[i]);
        successCount++;
      } catch (error) {
        failCount++;
      }
      setDeleteProgress({ current: i + 1, total: ids.length });
    }

    // Refresh profiles in store
    await loadProfiles(true);

    // Set result
    setDeleteResult({ success: successCount, failed: failCount });
    setIsDeleting(false);

    // Clear selection
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleCancelDelete = () => {
    cancelDeleteRef.current = true;
  };

  const handleCloseDeleteProgress = () => {
    setIsDeleting(false);
    setDeleteProgress({ current: 0, total: 0 });
    setDeleteResult(null);
    cancelDeleteRef.current = false;
  };

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ item: ProxyProfile }> }) => {
      for (const v of viewableItems) {
        if (v.item) {
          enqueueCheck(v.item);
        }
      }
    },
    [enqueueCheck],
  );

  const renderProfile = useCallback(
    ({ item }: { item: ProxyProfile }) => {
      const isActive = item.id === activeProfileId;
      const isSelected = selectedIds.has(item.id);

      return (
        <ProfileListItem
          item={item}
          isActive={isActive}
          isSelected={isSelected}
          isSelectionMode={isSelectionMode}
          onSelect={handleSelectProfile}
          onToggleSelect={toggleSelection}
          onCheck={handleCheckProfile}
          onEdit={handleEditProfile}
          onDelete={handleDeleteProfile}
          styles={styles}
          colors={colors}
        />
      );
    },
    [
      activeProfileId,
      selectedIds,
      isSelectionMode,
      colors,
      styles,
      handleSelectProfile,
      handleCheckProfile,
      handleEditProfile,
      handleDeleteProfile,
    ],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Normal header */}
      {!isSelectionMode ? (
        <View style={styles.header}>
          <View
            style={[
              styles.headerActions,
              { flex: 1, justifyContent: "flex-end" },
            ]}
          >
            {profiles.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={toggleSelectionMode}
                >
                  <Ionicons
                    name="checkbox-outline"
                    size={22}
                    color={colors.text.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => setIsHealthCheckModalVisible(true)}
                >
                  <Ionicons
                    name="pulse-outline"
                    size={22}
                    color={colors.text.primary}
                  />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => setIsProxySourcesModalVisible(true)}
            >
              <Ionicons
                name="server-outline"
                size={22}
                color={colors.text.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => setIsImportModalVisible(true)}
            >
              <Ionicons
                name="cloud-download-outline"
                size={22}
                color={colors.text.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddProfile}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Selection mode header - two rows for better UX */
        <View style={styles.selectionModeContainer}>
          <View style={styles.selectionTopRow}>
            <View style={styles.selectionHeader}>
              <TouchableOpacity onPress={toggleSelectionMode}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.selectionCount}>
                {selectedIds.size} selected
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.deleteSelectedButton,
                selectedIds.size === 0 && styles.disabledButton,
              ]}
              onPress={handleDeleteSelected}
              disabled={selectedIds.size === 0}
            >
              <Ionicons name="trash" size={18} color={colors.text.inverse} />
              <Text style={styles.deleteSelectedText}>Delete</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.selectionBottomRow}>
            <TouchableOpacity
              style={styles.selectOptionButton}
              onPress={
                selectedIds.size === profiles.length ? deselectAll : selectAll
              }
            >
              <Ionicons
                name={
                  selectedIds.size === profiles.length
                    ? "square-outline"
                    : "checkbox-outline"
                }
                size={18}
                color={colors.interactive.primary}
              />
              <Text style={styles.selectOptionText}>
                {selectedIds.size === profiles.length
                  ? "Deselect All"
                  : "Select All"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.selectOptionButton}
              onPress={selectUnhealthy}
            >
              <Ionicons name="pulse" size={18} color={colors.status.error} />
              <Text
                style={[
                  styles.selectOptionText,
                  { color: colors.status.error },
                ]}
              >
                Select Unhealthy
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.selectOptionButton}
              onPress={handleDeleteUnhealthy}
            >
              <Ionicons name="trash" size={18} color={colors.status.error} />
              <Text
                style={[
                  styles.selectOptionText,
                  { color: colors.status.error },
                ]}
              >
                Delete Unhealthy
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons
            name="search"
            size={18}
            color={colors.text.tertiary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or host..."
            placeholderTextColor={colors.text.tertiary}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              style={styles.clearButton}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tag Filters */}
      {allTags.length > 0 && (
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedTag === null && styles.filterChipActive,
              ]}
              onPress={() => setSelectedTag(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedTag === null && styles.filterChipTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {allTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.filterChip,
                  selectedTag === tag && styles.filterChipActive,
                ]}
                onPress={() => setSelectedTag(tag === selectedTag ? null : tag)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedTag === tag && styles.filterChipTextActive,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filteredProfiles}
        renderItem={renderProfile}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews
        initialNumToRender={20}
        windowSize={7}
        maxToRenderPerBatch={20}
        updateCellsBatchingPeriod={50}
        // Removed getItemLayout to allow FlatList to measure variable-height items
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
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
      <ImportProfileModal
        visible={isImportModalVisible}
        onClose={() => setIsImportModalVisible(false)}
        onSuccess={() => loadProfiles(false)}
      />
      <HealthCheckToast />
      <HealthCheckModal
        visible={isHealthCheckModalVisible}
        onClose={() => setIsHealthCheckModalVisible(false)}
      />
      <ProxySourcesModal
        visible={isProxySourcesModalVisible}
        onClose={() => setIsProxySourcesModalVisible(false)}
      />

      {/* Delete Progress Modal */}
      <Modal
        visible={isDeleting || deleteResult !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseDeleteProgress}
      >
        <View style={styles.progressOverlay}>
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>
                {deleteResult ? "Delete Complete" : "Deleting Profiles..."}
              </Text>
              {!isDeleting && (
                <TouchableOpacity onPress={handleCloseDeleteProgress}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={colors.text.primary}
                  />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.progressContent}>
              {deleteResult ? (
                // Result view
                <View style={styles.resultSection}>
                  <Ionicons
                    name="checkmark-done-circle"
                    size={48}
                    color={colors.status.success}
                  />
                  <Text style={styles.resultTitle}>Done!</Text>
                  <View style={styles.resultStats}>
                    <Text
                      style={[
                        styles.resultStat,
                        { color: colors.status.success },
                      ]}
                    >
                      ✅ {deleteResult.success} deleted
                    </Text>
                    {deleteResult.failed > 0 && (
                      <Text
                        style={[
                          styles.resultStat,
                          { color: colors.status.error },
                        ]}
                      >
                        ❌ {deleteResult.failed} failed
                      </Text>
                    )}
                  </View>
                </View>
              ) : (
                // Progress view
                <View style={styles.progressSection}>
                  <Text style={styles.progressText}>
                    Deleting: {deleteProgress.current} / {deleteProgress.total}
                  </Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${deleteProgress.total > 0 ? (deleteProgress.current / deleteProgress.total) * 100 : 0}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressPercent}>
                    {deleteProgress.total > 0
                      ? Math.round(
                          (deleteProgress.current / deleteProgress.total) * 100,
                        )
                      : 0}
                    %
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.progressFooter}>
              {deleteResult ? (
                <TouchableOpacity
                  style={[styles.progressButton, styles.progressButtonPrimary]}
                  onPress={handleCloseDeleteProgress}
                >
                  <Text style={styles.progressButtonPrimaryText}>Close</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.progressButton, styles.progressButtonCancel]}
                  onPress={handleCancelDelete}
                >
                  <Text style={styles.progressButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
    selectionModeContainer: {
      backgroundColor: theme.colors.background.secondary,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    selectionTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    selectionBottomRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
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
    selectOptionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.colors.background.tertiary,
      borderRadius: theme.borderRadius.sm,
    },
    selectOptionText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.interactive.primary,
      fontWeight: theme.typography.fontWeight.medium,
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
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
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
    healthDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: theme.spacing.sm,
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
    healthLatency: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.text.tertiary,
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
    searchBarContainer: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    searchInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border.primary,
      paddingHorizontal: theme.spacing.md,
    },
    searchIcon: {
      marginRight: theme.spacing.sm,
    },
    searchInput: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      color: theme.colors.text.primary,
      fontSize: theme.typography.fontSize.md,
    },
    clearButton: {
      padding: theme.spacing.xs,
    },
    filterContainer: {
      paddingBottom: theme.spacing.sm,
    },
    filterContent: {
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    filterChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: 20,
      backgroundColor: theme.colors.background.tertiary,
      borderWidth: 1,
      borderColor: theme.colors.border.primary,
    },
    filterChipActive: {
      backgroundColor: theme.colors.interactive.primary,
      borderColor: theme.colors.interactive.primary,
    },
    filterChipText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    filterChipTextActive: {
      color: theme.colors.text.inverse,
    },
    // Progress Modal styles
    progressOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.md,
    },
    progressContainer: {
      width: "100%",
      maxWidth: 350,
      backgroundColor: theme.colors.background.primary,
      borderRadius: theme.borderRadius.lg,
      overflow: "hidden",
      shadowColor: theme.colors.shadow.color,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme.colors.shadow.opacity,
      shadowRadius: 8,
      elevation: 5,
    },
    progressHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.primary,
    },
    progressTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
    },
    progressContent: {
      padding: theme.spacing.lg,
      minHeight: 150,
      justifyContent: "center",
    },
    progressSection: {
      gap: theme.spacing.sm,
    },
    progressText: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text.primary,
      textAlign: "center",
    },
    progressBarBg: {
      height: 12,
      backgroundColor: theme.colors.background.tertiary,
      borderRadius: 6,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: theme.colors.interactive.primary,
      borderRadius: 6,
    },
    progressPercent: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
      textAlign: "center",
    },
    resultSection: {
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    resultTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
    },
    resultStats: {
      flexDirection: "row",
      gap: theme.spacing.lg,
    },
    resultStat: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
    },
    progressFooter: {
      padding: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.primary,
    },
    progressButton: {
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: "center",
    },
    progressButtonPrimary: {
      backgroundColor: theme.colors.interactive.primary,
    },
    progressButtonPrimaryText: {
      color: theme.colors.text.inverse,
      fontWeight: theme.typography.fontWeight.bold,
    },
    progressButtonCancel: {
      backgroundColor: theme.colors.background.tertiary,
    },
    progressButtonCancelText: {
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeight.medium,
    },
  });
