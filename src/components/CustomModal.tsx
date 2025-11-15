/**
 * Custom Modal Component
 *
 * A themed modal component to replace Alert.alert with better UX and design.
 * Features smooth animations, theme support, and different modal types.
 *
 * @module components/CustomModal
 */

import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions,
  StyleSheet,
  Platform,
} from "react-native";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../hooks/useTheme";
import type { Theme } from "../types/theme";
import type { ModalConfig, ModalButton } from "../types/modal";

const WINDOW_HEIGHT = Dimensions.get("window").height;
const MAX_MODAL_HEIGHT = WINDOW_HEIGHT * 0.7;

interface CustomModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Modal configuration */
  config: ModalConfig | null;
  /** Callback when modal is dismissed */
  onDismiss: () => void;
}

/**
 * CustomModal Component
 *
 * Displays a themed modal with animations and customizable content.
 * Supports different types (success, error, warning, info, confirm) with
 * appropriate icons and colors.
 */
export const CustomModal: React.FC<CustomModalProps> = ({
  visible,
  config,
  onDismiss,
}) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.8)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  // Animate in/out based on visibility
  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(modalScale, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(modalScale, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, backdropOpacity, modalScale, modalOpacity]);

  if (!config) return null;

  const { type, title, message, buttons, dismissable } = config;

  // Determine if dismissable (default: true for info/success/error, false for confirm)
  const canDismiss = dismissable ?? type !== "confirm";

  // Get icon and color for modal type
  const getModalTypeConfig = () => {
    switch (type) {
      case "success":
        return {
          icon: "✓",
          color: colors.status.success,
          iconBg: `${colors.status.success}20`,
        };
      case "error":
        return {
          icon: "✕",
          color: colors.status.error,
          iconBg: `${colors.status.error}20`,
        };
      case "warning":
        return {
          icon: "⚠",
          color: colors.status.warning,
          iconBg: `${colors.status.warning}20`,
        };
      case "info":
        return {
          icon: "ⓘ",
          color: colors.status.info,
          iconBg: `${colors.status.info}20`,
        };
      case "confirm":
        return {
          icon: "?",
          color: colors.interactive.primary,
          iconBg: `${colors.interactive.primary}20`,
        };
      default:
        return {
          icon: "ⓘ",
          color: colors.interactive.primary,
          iconBg: `${colors.interactive.primary}20`,
        };
    }
  };

  const typeConfig = getModalTypeConfig();

  // Default buttons if none provided
  const modalButtons: ModalButton[] = buttons || [
    {
      text: "OK",
      onPress: onDismiss,
      style: "default",
    },
  ];

  const handleBackdropPress = () => {
    if (canDismiss) {
      if (config.onDismiss) {
        config.onDismiss();
      }
      onDismiss();
    }
  };

  const handleButtonPress = (button: ModalButton) => {
    if (button.onPress) {
      button.onPress();
    }
    onDismiss();
  };

  const getButtonStyle = (button: ModalButton, index: number) => {
    const isLastButton = index === modalButtons.length - 1;
    const buttonStyle = button.style || "default";

    switch (buttonStyle) {
      case "cancel":
        return [
          styles.button,
          styles.buttonSecondary,
          !isLastButton && styles.buttonMargin,
        ];
      case "destructive":
        return [
          styles.button,
          styles.buttonDestructive,
          !isLastButton && styles.buttonMargin,
        ];
      case "default":
      default:
        return [
          styles.button,
          styles.buttonPrimary,
          !isLastButton && styles.buttonMargin,
        ];
    }
  };

  const getButtonTextStyle = (button: ModalButton) => {
    const buttonStyle = button.style || "default";

    switch (buttonStyle) {
      case "cancel":
        return [styles.buttonText, styles.buttonTextSecondary];
      case "destructive":
        return [styles.buttonText, styles.buttonTextDestructive];
      case "default":
      default:
        return [styles.buttonText, styles.buttonTextPrimary];
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleBackdropPress}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleBackdropPress}
          />
        </Animated.View>

        {/* Modal Content */}
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: modalOpacity,
              transform: [{ scale: modalScale }],
            },
          ]}
        >
          <View style={styles.modal}>
            {/* Icon */}
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: typeConfig.iconBg },
              ]}
            >
              <Text style={[styles.icon, { color: typeConfig.color }]}>
                {typeConfig.icon}
              </Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Message */}
            <ScrollView
              style={styles.messageScrollView}
              contentContainerStyle={styles.messageScrollContent}
              bounces={false}
            >
              <Text style={styles.message}>{message}</Text>
            </ScrollView>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {modalButtons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={getButtonStyle(button, index)}
                  onPress={() => handleButtonPress(button)}
                  activeOpacity={0.8}
                >
                  <Text style={getButtonTextStyle(button)}>{button.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalContainer: {
      width: "85%",
      maxWidth: 400,
      maxHeight: MAX_MODAL_HEIGHT,
    },
    modal: {
      backgroundColor: theme.colors.background.elevated,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      shadowColor: theme.colors.shadow.color,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme.colors.shadow.opacity * 2,
      shadowRadius: 12,
      elevation: 8,
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "center",
      marginBottom: theme.spacing.md,
    },
    icon: {
      fontSize: 32,
      fontWeight: theme.typography.fontWeight.bold,
    },
    title: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
      textAlign: "center",
      marginBottom: theme.spacing.sm,
    },
    messageScrollView: {
      maxHeight: MAX_MODAL_HEIGHT * 0.4,
      marginBottom: theme.spacing.lg,
    },
    messageScrollContent: {
      flexGrow: 1,
    },
    message: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text.secondary,
      textAlign: "center",
      lineHeight: theme.typography.fontSize.md * 1.5,
    },
    buttonContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    button: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44, // Minimum touch target size
    },
    buttonMargin: {
      marginRight: theme.spacing.sm,
    },
    buttonPrimary: {
      backgroundColor: theme.colors.interactive.primary,
    },
    buttonSecondary: {
      backgroundColor: theme.colors.background.tertiary,
      borderWidth: 1,
      borderColor: theme.colors.border.primary,
    },
    buttonDestructive: {
      backgroundColor: theme.colors.status.error,
    },
    buttonText: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
    },
    buttonTextPrimary: {
      color: theme.colors.text.inverse,
    },
    buttonTextSecondary: {
      color: theme.colors.text.primary,
    },
    buttonTextDestructive: {
      color: theme.colors.text.inverse,
    },
  });
