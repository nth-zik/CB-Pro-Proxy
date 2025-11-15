/**
 * useThemedStyles Hook
 *
 * A utility hook for creating theme-aware StyleSheet objects.
 * Provides type-safe style factories that automatically update when theme changes.
 *
 * Features:
 * - Type-safe style definitions
 * - Automatic memoization to prevent unnecessary re-renders
 * - Access to full theme object and colors
 * - Performance optimized
 *
 * @module hooks/useThemedStyles
 */

import { useMemo } from "react";
import { StyleSheet, ImageStyle, TextStyle, ViewStyle } from "react-native";
import { useTheme } from "./useTheme";
import { Theme, ColorPalette } from "../types/theme";

/**
 * Named styles type that can contain any combination of view, text, and image styles
 */
type NamedStyles<T> = {
  [P in keyof T]: ViewStyle | TextStyle | ImageStyle;
};

/**
 * Style factory function type
 * Receives theme and colors, returns a StyleSheet-compatible object
 */
type StyleFactory<T extends NamedStyles<T>> = (
  theme: Theme,
  colors: ColorPalette
) => T | NamedStyles<T>;

/**
 * useThemedStyles Hook
 *
 * Creates theme-aware styles that automatically update when theme changes.
 * Uses memoization to optimize performance and prevent unnecessary re-renders.
 *
 * @param styleFactory - Function that receives theme and colors, returns styles
 * @returns Memoized StyleSheet object
 *
 * @example
 * ```typescript
 * import { useThemedStyles } from '../hooks/useThemedStyles';
 *
 * function MyComponent() {
 *   const styles = useThemedStyles((theme, colors) =>
 *     StyleSheet.create({
 *       container: {
 *         backgroundColor: colors.background.primary,
 *         padding: theme.spacing.md,
 *         borderRadius: theme.borderRadius.lg,
 *       },
 *       title: {
 *         color: colors.text.primary,
 *         fontSize: theme.typography.fontSize.xl,
 *         fontWeight: theme.typography.fontWeight.bold,
 *       },
 *       button: {
 *         backgroundColor: colors.interactive.primary,
 *         padding: theme.spacing.sm,
 *         borderRadius: theme.borderRadius.md,
 *       },
 *     })
 *   );
 *
 *   return (
 *     <View style={styles.container}>
 *       <Text style={styles.title}>Hello World</Text>
 *       <TouchableOpacity style={styles.button}>
 *         <Text>Click Me</Text>
 *       </TouchableOpacity>
 *     </View>
 *   );
 * }
 * ```
 *
 * @example With VPN status colors
 * ```typescript
 * function ConnectionButton() {
 *   const { vpnStatus } = useVPNStore();
 *
 *   const styles = useThemedStyles((theme, colors) =>
 *     StyleSheet.create({
 *       button: {
 *         backgroundColor: colors.vpn[vpnStatus],
 *         padding: theme.spacing.md,
 *         borderRadius: theme.borderRadius.round,
 *       },
 *     })
 *   );
 *
 *   return <TouchableOpacity style={styles.button}>...</TouchableOpacity>;
 * }
 * ```
 */
export function useThemedStyles<T extends NamedStyles<T>>(
  styleFactory: StyleFactory<T>
): T {
  const { theme, colors } = useTheme();

  // Memoize the styles to prevent recreation on every render
  // Only recreate when theme or colors change
  return useMemo(() => {
    const styles = styleFactory(theme, colors);
    // If the factory returns a plain object, wrap it in StyleSheet.create
    // If it already returns a StyleSheet, use it directly
    return ((styles as any)._sheet ? styles : StyleSheet.create(styles)) as T;
  }, [theme, colors, styleFactory]);
}
