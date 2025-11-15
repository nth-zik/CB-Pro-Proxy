/**
 * Theme Type Definitions
 *
 * Defines TypeScript types for the theme system including color palettes,
 * spacing, typography, and theme modes.
 *
 * @module types/theme
 */

/**
 * Theme mode options
 * - 'light': Force light theme
 * - 'dark': Force dark theme
 * - 'system': Follow system preference
 */
export type ThemeMode = "light" | "dark" | "system";

/**
 * Resolved theme name (after system detection)
 */
export type ThemeName = "light" | "dark";

/**
 * Background color palette with WCAG 2.1 Level AA compliance
 */
export interface BackgroundColors {
  /** Main background color */
  primary: string;
  /** Card/section background colors */
  secondary: string;
  /** Input field backgrounds */
  tertiary: string;
  /** Elevated surface backgrounds (modals, dialogs) */
  elevated: string;
}

/**
 * Text color palette with WCAG 2.1 Level AA compliance
 * All colors maintain contrast ratio ≥ 4.5:1 with backgrounds
 */
export interface TextColors {
  /** Main body text */
  primary: string;
  /** Subtitle/description text */
  secondary: string;
  /** Disabled/placeholder text */
  tertiary: string;
  /** Text on colored backgrounds */
  inverse: string;
}

/**
 * Interactive element colors (buttons, links, etc.)
 */
export interface InteractiveColors {
  /** Primary action color */
  primary: string;
  /** Secondary action color */
  secondary: string;
  /** Disabled state color */
  disabled: string;
  /** Hover/press state color */
  hover: string;
}

/**
 * Status/feedback colors
 */
export interface StatusColors {
  /** Success state (e.g., VPN connected) */
  success: string;
  /** Warning state */
  warning: string;
  /** Error state */
  error: string;
  /** Informational state */
  info: string;
}

/**
 * VPN-specific status colors
 */
export interface VPNColors {
  /** VPN connected state */
  connected: string;
  /** VPN connecting state */
  connecting: string;
  /** VPN handshaking state */
  handshaking: string;
  /** VPN disconnected state */
  disconnected: string;
  /** VPN error state */
  error: string;
}

/**
 * Border and divider colors
 */
export interface BorderColors {
  /** Primary border color */
  primary: string;
  /** Secondary/subtle border color */
  secondary: string;
  /** Focused element border color */
  focus: string;
}

/**
 * Shadow properties
 */
export interface ShadowColors {
  /** Shadow color */
  color: string;
  /** Shadow opacity (0-1) */
  opacity: number;
}

/**
 * Tab bar colors
 */
export interface TabBarColors {
  /** Tab bar background */
  background: string;
  /** Tab bar border */
  border: string;
  /** Active tab color */
  active: string;
  /** Inactive tab color */
  inactive: string;
}

/**
 * Complete color palette for a theme
 */
export interface ColorPalette {
  background: BackgroundColors;
  text: TextColors;
  interactive: InteractiveColors;
  status: StatusColors;
  vpn: VPNColors;
  border: BorderColors;
  shadow: ShadowColors;
  tabBar: TabBarColors;
}

/**
 * Spacing scale (8pt grid system)
 */
export interface Spacing {
  /** 4px - Extra small spacing */
  xs: number;
  /** 8px - Small spacing */
  sm: number;
  /** 16px - Medium spacing */
  md: number;
  /** 24px - Large spacing */
  lg: number;
  /** 32px - Extra large spacing */
  xl: number;
}

/**
 * Border radius scale
 */
export interface BorderRadius {
  /** 4px - Small elements */
  sm: number;
  /** 8px - Default */
  md: number;
  /** 12px - Cards */
  lg: number;
  /** 16px - Large cards */
  xl: number;
  /** 999px - Pills/circular elements */
  round: number;
}

/**
 * Typography font size scale (Modular scale 1.25)
 */
export interface FontSize {
  /** 12px - Small labels */
  xs: number;
  /** 14px - Body text small */
  sm: number;
  /** 16px - Body text */
  md: number;
  /** 18px - Subheadings */
  lg: number;
  /** 24px - Headings */
  xl: number;
  /** 32px - Large headings */
  xxl: number;
}

/**
 * Typography font weight scale
 */
export interface FontWeight {
  /** Normal text */
  normal: "400";
  /** Medium emphasis */
  medium: "600";
  /** Bold text */
  bold: "700";
  /** Heavy emphasis */
  heavy: "800";
}

/**
 * Typography configuration
 */
export interface Typography {
  fontSize: FontSize;
  fontWeight: FontWeight;
}

/**
 * Complete theme definition
 */
export interface Theme {
  /** Theme identifier */
  name: ThemeName;
  /** Color palette */
  colors: ColorPalette;
  /** Spacing scale */
  spacing: Spacing;
  /** Border radius scale */
  borderRadius: BorderRadius;
  /** Typography configuration */
  typography: Typography;
}

/**
 * Theme context value provided to consumers
 */
export interface ThemeContextType {
  /** Current active theme */
  theme: Theme;
  /** Current theme colors */
  colors: ColorPalette;
  /** Current theme mode setting */
  themeMode: ThemeMode;
  /** Current resolved theme name */
  currentTheme: ThemeName;
  /** Set theme mode */
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  /** Check if dark mode is active */
  isDark: boolean;
}
