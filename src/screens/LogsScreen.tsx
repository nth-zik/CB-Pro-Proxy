/**
 * LogsScreen - Simple logs viewer
 *
 * Features:
 * - Real-time log display
 * - Clear logs
 * - Dark mode support
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useLoggingStore } from "../store/loggingStore";
import { LogEntry } from "../components/LogEntry";
import { useCustomModal } from "../hooks";
import { CustomModal } from "../components/CustomModal";
import type { Theme } from "../types/theme";

export const LogsScreen: React.FC = () => {
  const styles = useThemedStyles(createStyles);
  const { logs, clearLogs } = useLoggingStore();
  const modal = useCustomModal();

  // Sort logs by timestamp (newest first) and ensure unique keys
  const sortedLogs = React.useMemo(() => {
    const sorted = [...logs].sort((a, b) => b.timestamp - a.timestamp);

    // DEBUG: Check for duplicate IDs in the sorted logs
    const idSet = new Set<string>();
    const duplicates: string[] = [];
    sorted.forEach((log) => {
      if (idSet.has(log.id)) {
        duplicates.push(log.id);
      }
      idSet.add(log.id);
    });

    if (duplicates.length > 0) {
      console.error(
        `[LogsScreen] Found ${duplicates.length} duplicate IDs:`,
        duplicates
      );
    }

    return sorted;
  }, [logs]);

  // Handle clear logs
  const handleClearLogs = useCallback(() => {
    modal.showConfirm(
      "Clear Logs",
      "Are you sure you want to clear all logs? This action cannot be undone.",
      () => {
        clearLogs();
        modal.showSuccess("Success", "All logs have been cleared");
      },
      undefined,
      "Clear",
      "Cancel"
    );
  }, [clearLogs, modal]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Logs ({logs.length})</Text>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearLogs}
          >
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        </View>

        {/* Logs List */}
        {sortedLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No logs yet</Text>
            <Text style={styles.emptySubtext}>
              Logs will appear here as the app runs
            </Text>
          </View>
        ) : (
          <FlatList
            data={sortedLogs}
            keyExtractor={(item, index) => {
              // Use ID as primary key, but fallback to index if ID is duplicated
              // This prevents React key warnings while we investigate the root cause
              return `${item.id}-${index}`;
            }}
            renderItem={({ item }) => <LogEntry entry={item} />}
            contentContainerStyle={styles.listContent}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={10}
            windowSize={5}
          />
        )}
      </View>
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
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    title: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
    },
    clearButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.colors.interactive.primary,
      borderRadius: theme.borderRadius.md,
    },
    clearButtonText: {
      color: theme.colors.text.inverse,
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
    },
    listContent: {
      paddingVertical: 8,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    emptyText: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text.secondary,
      textAlign: "center",
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text.tertiary,
      textAlign: "center",
    },
  });

export default LogsScreen;
