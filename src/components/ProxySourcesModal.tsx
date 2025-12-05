import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useCustomModal } from "../hooks/useCustomModal";
import { CustomModal } from "./CustomModal";
import type { Theme } from "../types/theme";
import { ProxySource, ProxyType, ProxyProfile } from "../types";
import { useProxySourceStore } from "../store/proxySourceStore";
import { useVPNStore } from "../store";
import { FetchResult } from "../services/ProxySourceService";
import { storageService } from "../services";

interface ProxySourcesModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ProxySourcesModal: React.FC<ProxySourcesModalProps> = ({
  visible,
  onClose,
}) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const modal = useCustomModal();

  const {
    sources,
    isLoading,
    isFetching,
    fetchingSourceIds,
    loadSources,
    addSource,
    deleteSource,
    refetchSource,
    refetchAllSources,
    updateSource,
  } = useProxySourceStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newProtocol, setNewProtocol] = useState<ProxyType | null>(null);
  const [newTags, setNewTags] = useState("");
  const [newAutoFetch, setNewAutoFetch] = useState(true);
  const [newInterval, setNewInterval] = useState("24");
  const [isAdding, setIsAdding] = useState(false);
  const [fetchResults, setFetchResults] = useState<Map<string, FetchResult>>(
    new Map()
  );

  // Delete progress state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });
  const [deleteResult, setDeleteResult] = useState<{ success: number; failed: number } | null>(null);
  const cancelDeleteRef = useRef(false);

  useEffect(() => {
    if (visible) {
      loadSources();
    }
  }, [visible]);

  const resetForm = () => {
    setNewName("");
    setNewUrl("");
    setNewProtocol(null);
    setNewTags("");
    setNewAutoFetch(true);
    setNewInterval("24");
    setShowAddForm(false);
    setIsAdding(false);
  };

  const handleAddSource = async () => {
    if (!newName.trim() || !newUrl.trim()) {
      modal.showError("Error", "Name and URL are required");
      return;
    }

    setIsAdding(true);
    try {
      const tags = newTags
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await addSource(newName, newUrl, {
        defaultProtocol: newProtocol || undefined,
        tags: tags.length > 0 ? tags : undefined,
        autoFetch: newAutoFetch,
        fetchIntervalHours: parseInt(newInterval) || 24,
      });

      resetForm();
    } catch (error) {
      modal.showError("Error", "Failed to add source");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSource = (source: ProxySource) => {
    const { profiles } = useVPNStore.getState();
    
    // Find profiles that have tags matching this source's tags
    const sourceTags = source.tags || [];
    const profilesToDelete = sourceTags.length > 0 
      ? profiles.filter(p => p.tags?.some(t => sourceTags.includes(t)))
      : [];
    
    const hasProfiles = profilesToDelete.length > 0;
    
    if (hasProfiles) {
      // Show modal with 3 buttons for sources with associated profiles
      modal.showModal({
        type: "confirm",
        title: "Delete Source",
        message: `Delete "${source.name}"?\n\n${profilesToDelete.length} profile(s) were imported with tags from this source.`,
        buttons: [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {},
          },
          {
            text: "Source Only",
            style: "default",
            onPress: () => deleteSource(source.id),
          },
          {
            text: "Source + Profiles",
            style: "destructive",
            onPress: () => handleBulkDeleteWithProgress(source, profilesToDelete),
          },
        ],
        dismissable: false,
      });
    } else {
      // Simple confirm for sources without associated profiles
      modal.showConfirm(
        "Delete Source",
        `Are you sure you want to delete "${source.name}"?`,
        () => deleteSource(source.id),
        undefined,
        "Delete",
        "Cancel"
      );
    }
  };

  const handleBulkDeleteWithProgress = async (source: ProxySource, profilesToDelete: ProxyProfile[]) => {
    // Reset state
    setIsDeleting(true);
    setDeleteProgress({ current: 0, total: profilesToDelete.length });
    setDeleteResult(null);
    cancelDeleteRef.current = false;

    // Delete source first
    await deleteSource(source.id);

    let successCount = 0;
    let failCount = 0;

    // Delete profiles one by one with progress
    for (let i = 0; i < profilesToDelete.length; i++) {
      if (cancelDeleteRef.current) {
        break;
      }

      const profile = profilesToDelete[i];
      try {
        await storageService.deleteProfile(profile.id);
        successCount++;
      } catch (error) {
        failCount++;
      }
      setDeleteProgress({ current: i + 1, total: profilesToDelete.length });
    }

    // Refresh profiles in store
    const { loadProfiles } = useVPNStore.getState();
    await loadProfiles(true);

    // Set result
    setDeleteResult({ success: successCount, failed: failCount });
    setIsDeleting(false);
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

  const handleRefetchSource = async (source: ProxySource) => {
    const result = await refetchSource(source.id);
    setFetchResults((prev) => new Map(prev).set(source.id, result));

    // Clear result after 5 seconds
    setTimeout(() => {
      setFetchResults((prev) => {
        const newMap = new Map(prev);
        newMap.delete(source.id);
        return newMap;
      });
    }, 5000);
  };

  const handleRefetchAll = async () => {
    const results = await refetchAllSources();
    setFetchResults(results);

    // Clear results after 5 seconds
    setTimeout(() => {
      setFetchResults(new Map());
    }, 5000);
  };

  const handleToggleAutoFetch = async (source: ProxySource) => {
    await updateSource(source.id, { autoFetch: !source.autoFetch });
  };

  const formatLastFetch = (date?: Date) => {
    if (!date) return "Never";
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const renderSource = ({ item }: { item: ProxySource }) => {
    const isFetchingThis = fetchingSourceIds.has(item.id);
    const result = fetchResults.get(item.id);

    return (
      <View style={styles.sourceItem}>
        <View style={styles.sourceHeader}>
          <Text style={styles.sourceName}>{item.name}</Text>
          <View style={styles.sourceActions}>
            <TouchableOpacity
              onPress={() => handleRefetchSource(item)}
              disabled={isFetchingThis}
              style={styles.actionButton}
            >
              {isFetchingThis ? (
                <ActivityIndicator size="small" color={colors.interactive.primary} />
              ) : (
                <Ionicons
                  name="refresh"
                  size={20}
                  color={colors.interactive.primary}
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteSource(item)}
              style={styles.actionButton}
            >
              <Ionicons name="trash-outline" size={20} color={colors.status.error} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sourceUrl} numberOfLines={1}>
          {item.url}
        </Text>

        <View style={styles.sourceInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last fetch:</Text>
            <Text
              style={[
                styles.infoValue,
                item.lastFetchStatus === "error" && styles.errorText,
              ]}
            >
              {formatLastFetch(item.lastFetchAt)}
              {item.lastFetchStatus === "error" && " (failed)"}
            </Text>
          </View>
          {item.proxiesCount !== undefined && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Proxies:</Text>
              <Text style={styles.infoValue}>{item.proxiesCount}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Auto-fetch:</Text>
            <Switch
              value={item.autoFetch}
              onValueChange={() => handleToggleAutoFetch(item)}
              trackColor={{
                false: colors.background.tertiary,
                true: colors.interactive.primary,
              }}
              thumbColor={colors.text.inverse}
            />
          </View>
        </View>

        {result && (
          <View
            style={[
              styles.resultBanner,
              result.success ? styles.successBanner : styles.errorBanner,
            ]}
          >
            {result.success ? (
              <>
                <Text style={styles.resultText}>
                  ✅ Added: {result.addedCount} | Dup: {result.duplicatesCount} |
                  Invalid: {result.invalidCount}
                </Text>
                {result.limitExceeded && (
                  <Text style={[styles.resultText, { color: colors.status.warning }]}>
                    ⚠️ Limit reached: imported {result.addedCount} of {result.originalCount} proxies
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.resultText}>❌ {result.error}</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderAddForm = () => (
    <View style={styles.addForm}>
      <Text style={styles.formTitle}>Add New Source</Text>

      <TextInput
        style={styles.input}
        placeholder="Source Name"
        placeholderTextColor={colors.text.tertiary}
        value={newName}
        onChangeText={setNewName}
      />

      <TextInput
        style={styles.input}
        placeholder="URL (https://...)"
        placeholderTextColor={colors.text.tertiary}
        value={newUrl}
        onChangeText={setNewUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <View style={styles.formRow}>
        <Text style={styles.formLabel}>Default Protocol:</Text>
        <View style={styles.protocolRow}>
          <TouchableOpacity
            style={[
              styles.protocolChip,
              newProtocol === "http" && styles.protocolChipActive,
            ]}
            onPress={() => setNewProtocol("http")}
          >
            <Text
              style={[
                styles.protocolText,
                newProtocol === "http" && styles.protocolTextActive,
              ]}
            >
              HTTP
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.protocolChip,
              newProtocol === "socks5" && styles.protocolChipActive,
            ]}
            onPress={() => setNewProtocol("socks5")}
          >
            <Text
              style={[
                styles.protocolText,
                newProtocol === "socks5" && styles.protocolTextActive,
              ]}
            >
              SOCKS5
            </Text>
          </TouchableOpacity>
          {newProtocol && (
            <TouchableOpacity onPress={() => setNewProtocol(null)}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Tags (comma-separated)"
        placeholderTextColor={colors.text.tertiary}
        value={newTags}
        onChangeText={setNewTags}
      />

      <View style={styles.formRow}>
        <Text style={styles.formLabel}>Auto-fetch every</Text>
        <TextInput
          style={[styles.input, styles.intervalInput]}
          value={newInterval}
          onChangeText={setNewInterval}
          keyboardType="number-pad"
        />
        <Text style={styles.formLabel}>hours</Text>
        <Switch
          value={newAutoFetch}
          onValueChange={setNewAutoFetch}
          trackColor={{
            false: colors.background.tertiary,
            true: colors.interactive.primary,
          }}
          thumbColor={colors.text.inverse}
        />
      </View>

      <View style={styles.formButtons}>
        <TouchableOpacity
          style={[styles.formButton, styles.cancelButton]}
          onPress={resetForm}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.formButton, styles.saveButton]}
          onPress={handleAddSource}
          disabled={isAdding}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <Text style={styles.saveButtonText}>Add Source</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Proxy Sources</Text>
              <View style={styles.headerActions}>
                {sources.length > 0 && (
                  <TouchableOpacity
                    onPress={handleRefetchAll}
                    disabled={isFetching}
                    style={styles.headerButton}
                  >
                    {isFetching ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.interactive.primary}
                      />
                    ) : (
                      <Ionicons
                        name="refresh-circle"
                        size={28}
                        color={colors.interactive.primary}
                      />
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.content}>
              {isLoading ? (
                <ActivityIndicator
                  size="large"
                  color={colors.interactive.primary}
                  style={styles.loading}
                />
              ) : sources.length === 0 && !showAddForm ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="cloud-download-outline"
                    size={48}
                    color={colors.text.tertiary}
                  />
                  <Text style={styles.emptyText}>No proxy sources yet</Text>
                  <Text style={styles.emptySubtext}>
                    Add a URL to automatically fetch proxies
                  </Text>
                </View>
              ) : (
                <>
                  {sources.map((source) => (
                    <View key={source.id}>
                      {renderSource({ item: source })}
                    </View>
                  ))}
                </>
              )}

              {showAddForm && renderAddForm()}
            </ScrollView>

            {!showAddForm && (
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setShowAddForm(true)}
                >
                  <Ionicons name="add" size={24} color={colors.text.inverse} />
                  <Text style={styles.addButtonText}>Add Source</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
      <CustomModal
        visible={modal.visible}
        config={modal.config}
        onDismiss={modal.hideModal}
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
                  <Ionicons name="close" size={24} color={colors.text.primary} />
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
                    <Text style={[styles.resultStat, { color: colors.status.success }]}>
                      ✅ {deleteResult.success} deleted
                    </Text>
                    {deleteResult.failed > 0 && (
                      <Text style={[styles.resultStat, { color: colors.status.error }]}>
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
                    {deleteProgress.total > 0 ? Math.round((deleteProgress.current / deleteProgress.total) * 100) : 0}%
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
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    keyboardView: {
      flex: 1,
    },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.md,
    },
    container: {
      width: "100%",
      maxWidth: 500,
      minHeight: 500,
      maxHeight: "85%",
      backgroundColor: theme.colors.background.primary,
      borderRadius: theme.borderRadius.lg,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.primary,
    },
    title: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    headerButton: {
      padding: theme.spacing.xs,
    },
    content: {
      flex: 1,
      padding: theme.spacing.md,
    },
    loading: {
      marginTop: theme.spacing.xl,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    emptyText: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    emptySubtext: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.tertiary,
    },
    sourceItem: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    sourceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sourceName: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
      flex: 1,
    },
    sourceActions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    actionButton: {
      padding: theme.spacing.xs,
    },
    sourceUrl: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.tertiary,
      marginTop: theme.spacing.xs,
    },
    sourceInfo: {
      marginTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    infoLabel: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
    },
    infoValue: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.primary,
    },
    errorText: {
      color: theme.colors.status.error,
    },
    resultBanner: {
      marginTop: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
    },
    successBanner: {
      backgroundColor: theme.colors.status.success + "20",
    },
    errorBanner: {
      backgroundColor: theme.colors.status.error + "20",
    },
    resultText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.primary,
    },
    addForm: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    formTitle: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border.primary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.background.primary,
    },
    formRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      flexWrap: "wrap",
    },
    formLabel: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
    },
    protocolRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    protocolChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: 20,
      backgroundColor: theme.colors.background.tertiary,
      borderWidth: 1,
      borderColor: theme.colors.border.primary,
    },
    protocolChipActive: {
      backgroundColor: theme.colors.interactive.primary,
      borderColor: theme.colors.interactive.primary,
    },
    protocolText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
    },
    protocolTextActive: {
      color: theme.colors.text.inverse,
    },
    clearText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.tertiary,
    },
    intervalInput: {
      width: 60,
      textAlign: "center",
    },
    formButtons: {
      flexDirection: "row",
      gap: theme.spacing.md,
      marginTop: theme.spacing.sm,
    },
    formButton: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: "center",
    },
    cancelButton: {
      backgroundColor: theme.colors.background.tertiary,
    },
    cancelButtonText: {
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    saveButton: {
      backgroundColor: theme.colors.interactive.primary,
    },
    saveButtonText: {
      color: theme.colors.text.inverse,
      fontWeight: theme.typography.fontWeight.bold,
    },
    footer: {
      padding: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.primary,
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.interactive.primary,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      gap: theme.spacing.sm,
    },
    addButtonText: {
      color: theme.colors.text.inverse,
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.bold,
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
