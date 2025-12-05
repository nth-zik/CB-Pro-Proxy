import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { Theme } from "../types/theme";
import { useVPNStore } from "../store/vpnStore";
import { useProxyHealthStore } from "../store/proxyHealthStore";
import { ProxyProfile } from "../types";

interface HealthCheckModalProps {
  visible: boolean;
  onClose: () => void;
}

interface CheckResult {
  ok: number;
  fail: number;
  total: number;
}

export const HealthCheckModal: React.FC<HealthCheckModalProps> = ({
  visible,
  onClose,
}) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const profiles = useVPNStore((s) => s.profiles);
  const checkProfileHealth = useProxyHealthStore((s) => s.checkProfileHealth);
  const health = useProxyHealthStore((s) => s.health);

  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<CheckResult | null>(null);
  const cancelRef = useRef(false);

  const resetState = () => {
    setIsChecking(false);
    setProgress({ current: 0, total: 0 });
    setResult(null);
    cancelRef.current = false;
  };

  const handleClose = () => {
    if (isChecking) {
      cancelRef.current = true;
    }
    resetState();
    onClose();
  };

  const runHealthCheck = useCallback(async () => {
    if (profiles.length === 0) return;

    setIsChecking(true);
    setResult(null);
    cancelRef.current = false;

    const total = profiles.length;
    setProgress({ current: 0, total });

    let okCount = 0;
    let failCount = 0;
    let completed = 0;

    // Run checks in parallel batches
    const BATCH_SIZE = 10;
    const queue = [...profiles];

    const checkOne = async (profile: ProxyProfile) => {
      if (cancelRef.current) return;
      try {
        const result = await checkProfileHealth(profile);
        if (result.status === "ok") {
          okCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
      completed++;
      setProgress({ current: completed, total });
    };

    // Process in batches
    const runners: Promise<void>[] = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const run = async () => {
        while (queue.length > 0 && !cancelRef.current) {
          const profile = queue.shift();
          if (profile) {
            await checkOne(profile);
          }
        }
      };
      runners.push(run());
    }

    await Promise.all(runners);

    if (!cancelRef.current) {
      setResult({ ok: okCount, fail: failCount, total });
    }
    setIsChecking(false);
  }, [profiles, checkProfileHealth]);

  const progressPercent =
    progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  // Calculate current stats from health store
  const currentStats = {
    ok: Object.values(health).filter((h) => h.status === "ok").length,
    fail: Object.values(health).filter((h) => h.status === "fail").length,
    unknown: profiles.length - Object.keys(health).length,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Health Check</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Current Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={colors.status.success}
                />
                <Text style={styles.statValue}>{currentStats.ok}</Text>
                <Text style={styles.statLabel}>Healthy</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons
                  name="close-circle"
                  size={24}
                  color={colors.status.error}
                />
                <Text style={styles.statValue}>{currentStats.fail}</Text>
                <Text style={styles.statLabel}>Failed</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons
                  name="help-circle"
                  size={24}
                  color={colors.text.tertiary}
                />
                <Text style={styles.statValue}>{currentStats.unknown}</Text>
                <Text style={styles.statLabel}>Unknown</Text>
              </View>
            </View>

            {/* Progress Section */}
            {isChecking && (
              <View style={styles.progressSection}>
                <Text style={styles.progressText}>
                  Checking: {progress.current} / {progress.total}
                </Text>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressPercent}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressPercent}>
                  {Math.round(progressPercent)}%
                </Text>
              </View>
            )}

            {/* Result */}
            {result && !isChecking && (
              <View style={styles.resultSection}>
                <Ionicons
                  name="checkmark-done-circle"
                  size={48}
                  color={colors.status.success}
                />
                <Text style={styles.resultTitle}>Check Complete!</Text>
                <View style={styles.resultStats}>
                  <Text style={[styles.resultStat, { color: colors.status.success }]}>
                    ✅ {result.ok} healthy
                  </Text>
                  <Text style={[styles.resultStat, { color: colors.status.error }]}>
                    ❌ {result.fail} failed
                  </Text>
                </View>
              </View>
            )}

            {/* Info */}
            {!isChecking && !result && (
              <View style={styles.infoSection}>
                <Ionicons
                  name="information-circle-outline"
                  size={32}
                  color={colors.text.tertiary}
                />
                <Text style={styles.infoText}>
                  Check all {profiles.length} proxies to verify they're working.
                  This sends a test request through each proxy.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>
                {isChecking ? "Cancel" : "Close"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.checkButton,
                isChecking && styles.buttonDisabled,
              ]}
              onPress={runHealthCheck}
              disabled={isChecking || profiles.length === 0}
            >
              {isChecking ? (
                <ActivityIndicator color={colors.text.inverse} size="small" />
              ) : (
                <>
                  <Ionicons
                    name="pulse"
                    size={20}
                    color={colors.text.inverse}
                  />
                  <Text style={styles.checkButtonText}>
                    {result ? "Check Again" : "Start Check"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.md,
    },
    container: {
      width: "100%",
      maxWidth: 400,
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
    content: {
      padding: theme.spacing.lg,
      minHeight: 200,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginBottom: theme.spacing.lg,
    },
    statItem: {
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    statValue: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
    },
    statLabel: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
    },
    progressSection: {
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
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
      paddingVertical: theme.spacing.md,
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
    infoSection: {
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    infoText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
      textAlign: "center",
      lineHeight: 20,
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
      flexDirection: "row",
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
    },
    cancelButton: {
      backgroundColor: theme.colors.background.tertiary,
    },
    cancelButtonText: {
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    checkButton: {
      backgroundColor: theme.colors.interactive.primary,
    },
    checkButtonText: {
      color: theme.colors.text.inverse,
      fontWeight: theme.typography.fontWeight.bold,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
