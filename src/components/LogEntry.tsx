/**
 * LogEntry Component - Display individual log entry
 *
 * Features:
 * - Theme-aware styling
 * - Level-based color coding
 * - Expandable metadata
 * - Copy to clipboard
 */

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Clipboard,
} from "react-native";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useCustomModal } from "../hooks";
import { CustomModal } from "../components/CustomModal";
import type { LogEntry as LogEntryType } from "../types/logging";
import type { Theme } from "../types/theme";

interface LogEntryProps {
  entry: LogEntryType;
}

export const LogEntry: React.FC<LogEntryProps> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);
  const styles = useThemedStyles(createStyles);
  const modal = useCustomModal();

  // Format timestamp
  const timestamp = useMemo(() => {
    const date = new Date(entry.timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [entry.timestamp]);

  // Get level color
  const levelColor = useMemo(() => {
    switch (entry.level) {
      case "debug":
        return "#6B7280";
      case "info":
        return "#3B82F6";
      case "warn":
        return "#F59E0B";
      case "error":
        return "#EF4444";
      case "critical":
        return "#DC2626";
      default:
        return "#6B7280";
    }
  }, [entry.level]);

  // Handle copy to clipboard
  const handleCopy = () => {
    const text = JSON.stringify(
      {
        timestamp: new Date(entry.timestamp).toISOString(),
        level: entry.level,
        category: entry.category,
        message: entry.message,
        data: entry.data,
        stackTrace: entry.stackTrace,
      },
      null,
      2
    );

    Clipboard.setString(text);
    modal.showSuccess("Copied", "Log entry copied to clipboard");
  };

  // Check if has metadata
  const hasMetadata =
    entry.data || entry.stackTrace || entry.vpnStatus || entry.profileId;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => hasMetadata && setExpanded(!expanded)}
      activeOpacity={hasMetadata ? 0.7 : 1}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.timestamp}>{timestamp}</Text>
        <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
          <Text style={styles.levelText}>{entry.level.toUpperCase()}</Text>
        </View>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{entry.category}</Text>
        </View>
      </View>

      {/* Message */}
      <Text style={styles.message}>{entry.message}</Text>

      {/* Metadata (when expanded) */}
      {expanded && hasMetadata && (
        <View style={styles.metadata}>
          {entry.profileId && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataKey}>Profile ID:</Text>
              <Text style={styles.metadataValue}>{entry.profileId}</Text>
            </View>
          )}

          {entry.vpnStatus && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataKey}>VPN Status:</Text>
              <Text style={styles.metadataValue}>{entry.vpnStatus}</Text>
            </View>
          )}

          {entry.data && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataKey}>Data:</Text>
              <Text style={styles.metadataValue}>
                {JSON.stringify(entry.data, null, 2)}
              </Text>
            </View>
          )}

          {entry.stackTrace && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataKey}>Stack Trace:</Text>
              <Text style={[styles.metadataValue, styles.stackTrace]}>
                {entry.stackTrace}
              </Text>
            </View>
          )}

          {/* Copy Button */}
          <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
            <Text style={styles.copyButtonText}>Copy to Clipboard</Text>
          </TouchableOpacity>
        </View>
      )}
      <CustomModal
        visible={modal.visible}
        config={modal.config}
        onDismiss={modal.hideModal}
      />
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: 8,
      padding: 12,
      marginVertical: 4,
      marginHorizontal: 16,
      borderWidth: 1,
      borderColor: theme.colors.border.primary,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
      flexWrap: "wrap",
    },
    timestamp: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      fontFamily: "monospace",
      marginRight: 8,
    },
    levelBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      marginRight: 8,
    },
    levelText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "600",
    },
    categoryBadge: {
      backgroundColor: theme.colors.interactive.primary + "20",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    categoryText: {
      color: theme.colors.interactive.primary,
      fontSize: 10,
      fontWeight: "500",
    },
    message: {
      fontSize: 14,
      color: theme.colors.text.primary,
      lineHeight: 20,
    },
    metadata: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.secondary,
    },
    metadataRow: {
      marginBottom: 8,
    },
    metadataKey: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      fontWeight: "600",
      marginBottom: 2,
    },
    metadataValue: {
      fontSize: 12,
      color: theme.colors.text.primary,
      fontFamily: "monospace",
    },
    stackTrace: {
      fontSize: 10,
      lineHeight: 14,
    },
    copyButton: {
      backgroundColor: theme.colors.interactive.primary,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      marginTop: 8,
      alignSelf: "flex-start",
    },
    copyButtonText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "600",
    },
  });

export default LogEntry;
