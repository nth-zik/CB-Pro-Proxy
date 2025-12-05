import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { Theme } from "../types/theme";
import {
  importFromText,
  importFromUrl,
  importFromFile,
} from "../services/ProxyImportService";

interface ImportProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ImportProfileModal: React.FC<ImportProfileModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const [importMode, setImportMode] = useState<"paste" | "url" | "file">(
    "paste"
  );
  const [pasteText, setPasteText] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{
    added: number;
    duplicates: number;
    invalid: number;
  } | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [defaultProtocol, setDefaultProtocol] = useState<
    "http" | "socks5" | null
  >(null);
  const [tagsText, setTagsText] = useState("");
  const lines = pasteText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const hasScheme = lines.some((l) => l.includes("://"));
  const needsDefault = importMode === "paste" && lines.length > 0 && !hasScheme;

  const resetState = () => {
    setImportMode("paste");
    setPasteText("");
    setImportUrl("");
    setError(null);
    setImportStats(null);
    setProgress(null);
    setIsImporting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleImport = async () => {
    setError(null);
    setIsImporting(true);
    setImportStats(null);
    setProgress(null);

    try {
      let res;
      const onProgress = (current: number, total: number) => {
        setProgress({ current, total });
      };

      const extraTags = tagsText
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      if (importMode === "paste") {
        res = await importFromText(
          pasteText,
          onProgress,
          defaultProtocol ?? undefined,
          extraTags
        );
      } else if (importMode === "url") {
        res = await importFromUrl(
          importUrl,
          onProgress,
          defaultProtocol ?? undefined,
          extraTags
        );
      } else {
        res = await importFromFile(
          onProgress,
          defaultProtocol ?? undefined,
          extraTags
        );
      }

      setImportStats({
        added: res.valid.length,
        duplicates: res.duplicates,
        invalid: res.invalid.length,
      });

      if (onSuccess && res.valid.length > 0) {
        onSuccess();
      }

      // Auto-close dialog after successful import (with short delay so user can see stats)
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsImporting(false);
      setProgress(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.overlay}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Import Proxies</Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, importMode === "paste" && styles.activeTab]}
                onPress={() => setImportMode("paste")}
              >
                <Text
                  style={[
                    styles.tabText,
                    importMode === "paste" && styles.activeTabText,
                  ]}
                >
                  Paste
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, importMode === "url" && styles.activeTab]}
                onPress={() => setImportMode("url")}
              >
                <Text
                  style={[
                    styles.tabText,
                    importMode === "url" && styles.activeTabText,
                  ]}
                >
                  From URL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, importMode === "file" && styles.activeTab]}
                onPress={() => setImportMode("file")}
              >
                <Text
                  style={[
                    styles.tabText,
                    importMode === "file" && styles.activeTabText,
                  ]}
                >
                  From File
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              {importMode === "paste" && (
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Paste proxies here (one per line)"
                  placeholderTextColor={colors.text.tertiary}
                  multiline
                  value={pasteText}
                  onChangeText={setPasteText}
                />
              )}

              <View style={styles.protoContainer}>
                <Text
                  style={[
                    styles.protoLabel,
                    needsDefault ? styles.protoLabelWarn : null,
                  ]}
                >
                  Default protocol for lines without one
                </Text>
                <View style={styles.protoChipsRow}>
                  <TouchableOpacity
                    style={[
                      styles.protoChip,
                      defaultProtocol === "http" && styles.protoChipActive,
                    ]}
                    onPress={() => setDefaultProtocol("http")}
                  >
                    <Text
                      style={[
                        styles.protoChipText,
                        defaultProtocol === "http" && styles.protoChipTextActive,
                      ]}
                    >
                      HTTP
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.protoChip,
                      defaultProtocol === "socks5" && styles.protoChipActive,
                    ]}
                    onPress={() => setDefaultProtocol("socks5")}
                  >
                    <Text
                      style={[
                        styles.protoChipText,
                        defaultProtocol === "socks5" &&
                          styles.protoChipTextActive,
                      ]}
                    >
                      SOCKS5
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.protoClear}
                    onPress={() => setDefaultProtocol(null)}
                  >
                    <Text style={styles.protoClearText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.tagsContainer}>
                <Text style={styles.tagsLabel}>Tags (comma-separated)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. my-batch, vip, region-us"
                  placeholderTextColor={colors.text.tertiary}
                  value={tagsText}
                  onChangeText={setTagsText}
                />
              </View>

              {importMode === "url" && (
                <TextInput
                  style={styles.input}
                  placeholder="https://example.com/proxies.txt"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={importUrl}
                  onChangeText={setImportUrl}
                />
              )}

              {importMode === "file" && (
                <View style={styles.filePlaceholder}>
                  <Ionicons
                    name="document-text-outline"
                    size={48}
                    color={colors.text.tertiary}
                  />
                  <Text style={styles.fileText}>
                    Tap Import to select a .txt file
                  </Text>
                </View>
              )}

              {isImporting && progress && (
                <View style={styles.progressContainer}>
                  <Text style={styles.progressText}>
                    Importing: {progress.current} / {progress.total}
                  </Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${(progress.current / progress.total) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}

              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons
                    name="alert-circle"
                    size={20}
                    color={colors.status.error}
                  />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {importStats && (
                <View style={styles.statsContainer}>
                  <Text style={styles.statsText}>
                    ✅ Added: {importStats.added}
                  </Text>
                  <Text style={styles.statsText}>
                    ⚠️ Duplicates: {importStats.duplicates}
                  </Text>
                  <Text style={styles.statsText}>
                    ❌ Invalid: {importStats.invalid}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.importButton]}
                onPress={handleImport}
                disabled={isImporting}
              >
                {isImporting ? (
                  <ActivityIndicator color={colors.text.inverse} size="small" />
                ) : (
                  <Text style={styles.importButtonText}>Import</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    keyboardAvoidingView: {
      flex: 1,
    },
    overlay: {
      flexGrow: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.md,
    },
    container: {
      width: "100%",
      maxWidth: 500,
      backgroundColor: theme.colors.background.primary,
      borderRadius: theme.borderRadius.lg,
      overflow: "hidden",
      shadowColor: theme.colors.shadow.color,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme.colors.shadow.opacity,
      shadowRadius: 8,
      elevation: 5,
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
    tabs: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.primary,
    },
    tab: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      alignItems: "center",
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.interactive.primary,
    },
    tabText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    activeTabText: {
      color: theme.colors.interactive.primary,
      fontWeight: theme.typography.fontWeight.bold,
    },
    content: {
      padding: theme.spacing.md,
      minHeight: 200,
    },
    tagsContainer: {
      marginTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    tagsLabel: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
    },
    protoContainer: {
      marginTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    protoLabel: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
    },
    protoLabelWarn: {
      color: theme.colors.status.error,
    },
    protoChipsRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      alignItems: "center",
    },
    protoChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: 20,
      backgroundColor: theme.colors.background.tertiary,
      borderWidth: 1,
      borderColor: theme.colors.border.primary,
    },
    protoChipActive: {
      backgroundColor: theme.colors.interactive.primary,
      borderColor: theme.colors.interactive.primary,
    },
    protoChipText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    protoChipTextActive: {
      color: theme.colors.text.inverse,
    },
    protoClear: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    protoClearText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border.primary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.background.secondary,
    },
    textArea: {
      height: 150,
      textAlignVertical: "top",
    },
    filePlaceholder: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: theme.spacing.md,
      minHeight: 150,
    },
    fileText: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.fontSize.md,
    },
    errorContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: theme.spacing.md,
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.background.tertiary,
      borderRadius: theme.borderRadius.sm,
      gap: theme.spacing.xs,
    },
    errorText: {
      color: theme.colors.status.error,
      fontSize: theme.typography.fontSize.sm,
      flex: 1,
    },
    statsContainer: {
      marginTop: theme.spacing.md,
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.sm,
      gap: theme.spacing.xs,
    },
    statsText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
    },
    progressContainer: {
      marginTop: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    progressText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
      textAlign: "center",
    },
    progressBarBg: {
      height: 8,
      backgroundColor: theme.colors.background.tertiary,
      borderRadius: 4,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: theme.colors.interactive.primary,
    },
    footer: {
      flexDirection: "row",
      padding: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.primary,
      gap: theme.spacing.md,
    },
    button: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelButton: {
      backgroundColor: theme.colors.background.tertiary,
    },
    cancelButtonText: {
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    importButton: {
      backgroundColor: theme.colors.interactive.primary,
    },
    importButtonText: {
      color: theme.colors.text.inverse,
      fontWeight: theme.typography.fontWeight.bold,
    },
  });
