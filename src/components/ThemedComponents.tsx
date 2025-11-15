/**
 * Themed Components Library
 *
 * Reusable UI components with built-in dark mode support.
 * All components use theme colors and respond to theme changes automatically.
 *
 * @module components/ThemedComponents
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
  SwitchProps,
  StyleSheet,
} from "react-native";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../hooks/useTheme";
import type { Theme, ColorPalette } from "../types/theme";

// ============================================================================
// ThemedView
// ============================================================================

interface ThemedViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "primary" | "secondary" | "tertiary" | "elevated";
}

export const ThemedView: React.FC<ThemedViewProps> = ({
  children,
  style,
  variant = "primary",
}) => {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      container: {
        backgroundColor: theme.colors.background[variant],
      },
    })
  );

  return <View style={[styles.container, style]}>{children}</View>;
};

// ============================================================================
// ThemedText
// ============================================================================

interface ThemedTextProps {
  children: React.ReactNode;
  style?: TextStyle;
  variant?: "primary" | "secondary" | "tertiary" | "inverse";
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
  weight?: "normal" | "medium" | "bold" | "heavy";
}

export const ThemedText: React.FC<ThemedTextProps> = ({
  children,
  style,
  variant = "primary",
  size = "md",
  weight = "normal",
}) => {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      text: {
        color: theme.colors.text[variant],
        fontSize: theme.typography.fontSize[size],
        fontWeight: theme.typography.fontWeight[weight],
      },
    })
  );

  return <Text style={[styles.text, style]}>{children}</Text>;
};

// ============================================================================
// ThemedCard
// ============================================================================

interface ThemedCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}

export const ThemedCard: React.FC<ThemedCardProps> = ({
  children,
  style,
  elevated = false,
}) => {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      card: {
        backgroundColor: elevated
          ? theme.colors.background.elevated
          : theme.colors.background.secondary,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        shadowColor: theme.colors.shadow.color,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: theme.colors.shadow.opacity,
        shadowRadius: 6,
        elevation: elevated ? 4 : 2,
      },
    })
  );

  return <View style={[styles.card, style]}>{children}</View>;
};

// ============================================================================
// ThemedButton
// ============================================================================

interface ThemedButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export const ThemedButton: React.FC<ThemedButtonProps> = ({
  title,
  variant = "primary",
  size = "md",
  fullWidth = false,
  style,
  disabled,
  ...props
}) => {
  const styles = useThemedStyles((theme) =>
    createButtonStyles(theme, variant, size, fullWidth, disabled)
  );

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      disabled={disabled}
      activeOpacity={0.8}
      {...props}
    >
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
};

const createButtonStyles = (
  theme: Theme,
  variant: "primary" | "secondary" | "outline" | "ghost",
  size: "sm" | "md" | "lg",
  fullWidth: boolean,
  disabled?: boolean
) => {
  const sizeConfig = {
    sm: { padding: theme.spacing.xs, fontSize: theme.typography.fontSize.sm },
    md: { padding: theme.spacing.sm, fontSize: theme.typography.fontSize.md },
    lg: { padding: theme.spacing.md, fontSize: theme.typography.fontSize.lg },
  };

  const variantConfig = {
    primary: {
      backgroundColor: disabled
        ? theme.colors.interactive.disabled
        : theme.colors.interactive.primary,
      borderColor: "transparent",
      textColor: theme.colors.text.inverse,
    },
    secondary: {
      backgroundColor: disabled
        ? theme.colors.interactive.disabled
        : theme.colors.interactive.secondary,
      borderColor: "transparent",
      textColor: theme.colors.text.inverse,
    },
    outline: {
      backgroundColor: "transparent",
      borderColor: disabled
        ? theme.colors.interactive.disabled
        : theme.colors.interactive.primary,
      textColor: disabled
        ? theme.colors.text.tertiary
        : theme.colors.interactive.primary,
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: "transparent",
      textColor: disabled
        ? theme.colors.text.tertiary
        : theme.colors.interactive.primary,
    },
  };

  const config = variantConfig[variant];
  const sizing = sizeConfig[size];

  return StyleSheet.create({
    button: {
      backgroundColor: config.backgroundColor,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: sizing.padding * 2,
      paddingVertical: sizing.padding,
      alignItems: "center",
      justifyContent: "center",
      width: fullWidth ? "100%" : undefined,
      opacity: disabled ? 0.6 : 1,
    },
    text: {
      color: config.textColor,
      fontSize: sizing.fontSize,
      fontWeight: theme.typography.fontWeight.medium,
    },
  });
};

// ============================================================================
// ThemedSwitch
// ============================================================================

interface ThemedSwitchProps
  extends Omit<SwitchProps, "trackColor" | "thumbColor"> {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export const ThemedSwitch: React.FC<ThemedSwitchProps> = ({
  value,
  onValueChange,
  disabled,
  ...props
}) => {
  const { colors } = useTheme();

  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{
        false: colors.border.secondary,
        true: colors.interactive.primary,
      }}
      thumbColor={value ? colors.text.inverse : colors.background.tertiary}
      ios_backgroundColor={colors.border.secondary}
      {...props}
    />
  );
};

// ============================================================================
// ThemedDivider
// ============================================================================

interface ThemedDividerProps {
  style?: ViewStyle;
  variant?: "primary" | "secondary";
}

export const ThemedDivider: React.FC<ThemedDividerProps> = ({
  style,
  variant = "secondary",
}) => {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      divider: {
        height: 1,
        backgroundColor: theme.colors.border[variant],
      },
    })
  );

  return <View style={[styles.divider, style]} />;
};

// ============================================================================
// ThemedSettingRow
// ============================================================================

interface ThemedSettingRowProps extends TouchableOpacityProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  rightContent?: React.ReactNode;
  showChevron?: boolean;
}

export const ThemedSettingRow: React.FC<ThemedSettingRowProps> = ({
  title,
  subtitle,
  icon,
  rightContent,
  showChevron = false,
  style,
  ...props
}) => {
  const styles = useThemedStyles(createSettingRowStyles);

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      activeOpacity={props.onPress ? 0.7 : 1}
      {...props}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <View style={styles.textContainer}>
        <ThemedText weight="medium">{title}</ThemedText>
        {subtitle && (
          <ThemedText variant="secondary" size="sm" style={styles.subtitle}>
            {subtitle}
          </ThemedText>
        )}
      </View>
      {rightContent && <View style={styles.rightContent}>{rightContent}</View>}
      {showChevron && (
        <ThemedText variant="tertiary" style={styles.chevron}>
          ›
        </ThemedText>
      )}
    </TouchableOpacity>
  );
};

const createSettingRowStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.background.secondary,
    },
    iconContainer: {
      marginRight: theme.spacing.md,
    },
    textContainer: {
      flex: 1,
    },
    subtitle: {
      marginTop: theme.spacing.xs,
    },
    rightContent: {
      marginLeft: theme.spacing.sm,
    },
    chevron: {
      fontSize: 24,
      marginLeft: theme.spacing.sm,
    },
  });

// ============================================================================
// ThemedSectionHeader
// ============================================================================

interface ThemedSectionHeaderProps {
  title: string;
  style?: ViewStyle;
}

export const ThemedSectionHeader: React.FC<ThemedSectionHeaderProps> = ({
  title,
  style,
}) => {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      container: {
        paddingHorizontal: theme.spacing.md,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.sm,
        backgroundColor: theme.colors.background.primary,
      },
      title: {
        textTransform: "uppercase",
        letterSpacing: 1,
      },
    })
  );

  return (
    <View style={[styles.container, style]}>
      <ThemedText
        variant="secondary"
        size="sm"
        weight="medium"
        style={styles.title}
      >
        {title}
      </ThemedText>
    </View>
  );
};
