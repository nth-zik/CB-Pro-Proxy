import React, { memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ProxyProfile } from "../types";
import { useProxyHealthStore } from "../store/proxyHealthStore";

interface ProfileListItemProps {
  item: ProxyProfile;
  isActive: boolean;
  isSelected: boolean;
  isSelectionMode: boolean;
  onSelect: (item: ProxyProfile) => void;
  onToggleSelect: (id: string) => void;
  onCheck: (item: ProxyProfile) => void;
  onEdit: (item: ProxyProfile) => void;
  onDelete: (item: ProxyProfile) => void;
  styles: any;
  colors: any;
}

export const ProfileListItem = memo(
  ({
    item,
    isActive,
    isSelected,
    isSelectionMode,
    onSelect,
    onToggleSelect,
    onCheck,
    onEdit,
    onDelete,
    styles,
    colors,
  }: ProfileListItemProps) => {
    // Subscribe to specific health entry to avoid unnecessary re-renders
    const health = useProxyHealthStore((state) => state.health[item.id]);

    const statusColor =
      health?.status === "ok"
        ? colors.status.success
        : health?.status === "fail"
        ? colors.status.error
        : health?.status === "unsupported"
        ? colors.text.tertiary
        : colors.border.primary;

    return (
      <TouchableOpacity
        style={[
          styles.profileItem,
          isActive && styles.activeProfileItem,
          isSelected && styles.selectedProfileItem,
        ]}
        onPress={() => onSelect(item)}
        onLongPress={() => {
          if (!isSelectionMode) {
            onToggleSelect(item.id);
          }
        }}
      >
        <View style={styles.profileRow}>
          {isSelectionMode && (
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => onToggleSelect(item.id)}
            >
              <Ionicons
                name={isSelected ? "checkbox" : "square-outline"}
                size={24}
                color={
                  isSelected ? colors.interactive.primary : colors.text.tertiary
                }
              />
            </TouchableOpacity>
          )}

          <View
            style={[
              styles.profileInfo,
              isSelectionMode && styles.profileInfoWithCheckbox,
            ]}
          >
            <View style={styles.profileHeader}>
              <Text style={styles.profileName}>{item.name}</Text>
              {isActive && (
                <View style={styles.activeIndicator}>
                  <Text style={styles.activeText}>ACTIVE</Text>
                </View>
              )}
              <View
                style={[styles.healthDot, { backgroundColor: statusColor }]}
              />
            </View>
            <Text style={styles.profileDetails}>
              {item.type.toUpperCase()} • {item.host}:{item.port}
            </Text>
            {health?.latencyMs != null && (
              <Text style={styles.healthLatency}>
                Latency: {health.latencyMs} ms
              </Text>
            )}
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

        {!isSelectionMode && (
          <View style={styles.profileActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onCheck(item)}
            >
              <Text style={styles.actionButtonText}>Check</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onEdit(item)}
            >
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => onDelete(item)}
            >
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }
);
