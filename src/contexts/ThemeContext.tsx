/**
 * Theme Context
 *
 * Provides theme data and controls to the component tree via React Context.
 * Integrates with themeStore for state management and persistence.
 *
 * Features:
 * - Theme data accessible via useTheme hook
 * - Automatic theme initialization on mount
 * - System theme change listener
 * - Performance optimized with memoization
 *
 * @module contexts/ThemeContext
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import { useThemeStore, setupSystemThemeListener } from "../store/themeStore";
import { ThemeContextType } from "../types/theme";

/**
 * Theme context - provides theme data to consumers
 */
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * ThemeProvider Props
 */
interface ThemeProviderProps {
  /** Child components */
  children: ReactNode;
}

/**
 * ThemeProvider Component
 *
 * Wraps the app component tree to provide theme context.
 * Must be placed near the root of the component tree.
 *
 * @example
 * ```typescript
 * export default function App() {
 *   return (
 *     <ThemeProvider>
 *       <AppNavigator />
 *     </ThemeProvider>
 *   );
 * }
 * ```
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const {
    themeMode,
    currentTheme,
    setThemeMode,
    initializeTheme,
    getTheme,
    getColors,
    isInitialized,
  } = useThemeStore();

  // Initialize theme on mount
  useEffect(() => {
    if (!isInitialized) {
      initializeTheme();
    }
  }, [isInitialized, initializeTheme]);

  // Set up system theme change listener
  useEffect(() => {
    const cleanup = setupSystemThemeListener();
    return cleanup;
  }, []);

  // Memoize theme and colors to prevent unnecessary re-renders
  const theme = useMemo(() => getTheme(), [currentTheme, getTheme]);
  const colors = useMemo(() => getColors(), [currentTheme, getColors]);

  // Memoize context value
  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      colors,
      themeMode,
      currentTheme,
      setThemeMode,
      isDark: currentTheme === "dark",
    }),
    [theme, colors, themeMode, currentTheme, setThemeMode]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

/**
 * useTheme Hook
 *
 * Access theme context in components.
 * Must be used within ThemeProvider.
 *
 * @returns Theme context value
 * @throws Error if used outside ThemeProvider
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { theme, colors, isDark, setThemeMode } = useTheme();
 *
 *   return (
 *     <View style={{ backgroundColor: colors.background.primary }}>
 *       <Text style={{ color: colors.text.primary }}>
 *         Current theme: {isDark ? 'Dark' : 'Light'}
 *       </Text>
 *     </View>
 *   );
 * }
 * ```
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
};
