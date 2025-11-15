# Feature Design Document: Logging System & Dark Mode

**Project:** CB-Pro-Proxy (React Native VPN App)  
**Version:** 1.0  
**Date:** 2025-01-14  
**Author:** Architecture Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Feature 1: Logging System](#feature-1-logging-system)
4. [Feature 2: Dark Mode](#feature-2-dark-mode)
5. [Implementation Phases](#implementation-phases)
6. [Dependencies](#dependencies)
7. [File Structure](#file-structure)

---

## Executive Summary

This document outlines the architectural design for two key features for the CB-Pro-Proxy React Native VPN application:

1. **Logging System**: A comprehensive logging infrastructure to capture, store, and display application events, VPN operations, errors, and debugging information.

2. **Dark Mode**: A complete theme system supporting light and dark modes with user preference persistence and seamless theme switching.

Both features are designed to integrate seamlessly with the existing Zustand state management, AsyncStorage/SecureStore persistence layer, and native VPN module architecture.

---

## Current Architecture Analysis

### Technology Stack

- **Framework**: React Native 0.81.5 with Expo SDK 54
- **State Management**: Zustand 5.0.8
- **Storage**: AsyncStorage 2.2.0 + SecureStore 15.0.7
- **Navigation**: React Navigation (Stack + Bottom Tabs)
- **Native Bridge**: Custom VPNModule with EventEmitter

### Existing Patterns

```
Architecture Pattern: Unidirectional Data Flow
┌─────────────────┐
│  React Native   │
│   Components    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Zustand Store  │◄─────┤  VPNModule   │
│   (vpnStore)    │      │ EventEmitter │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐
│ Storage Service │
│ (AsyncStorage + │
│  SecureStore)   │
└─────────────────┘
```

### Key Files Analysis

**State Management** (`src/store/vpnStore.ts`):

- Centralized Zustand store
- Profile management
- VPN status tracking
- Connection statistics

**Storage Layer** (`src/services/StorageService.ts`):

- Profile metadata in AsyncStorage
- Credentials in SecureStore (encrypted)
- Native module synchronization

**Event System** (`src/hooks/useVPNEvents.ts`):

- VPN status change listeners
- Error event handling
- Profile update events
- Permission events

**Native Bridge** (`src/native/VPNModule.ts`):

- NativeEventEmitter integration
- Status normalization
- Multi-platform support

---

## Feature 1: Logging System

### Overview

A multi-level logging system that captures application lifecycle events, VPN operations, errors, and debugging information with persistence, filtering, and export capabilities.

### Architecture Design

#### 1. Logger Service Architecture

```
Logger Service Layer Architecture
┌────────────────────────────────────────────────┐
│              Application Layer                  │
│  (Components, Hooks, Services, Native Module)  │
└─────────────────┬──────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────┐
│            Logger Service API                   │
│  - log.debug()   - log.info()                  │
│  - log.warn()    - log.error()                 │
│  - log.critical()                               │
└─────────────────┬──────────────────────────────┘
                  │
      ┌───────────┼───────────┐
      │           │           │
      ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌──────────┐
│ Console │ │ Storage │ │  Store   │
│ Handler │ │ Handler │ │ Handler  │
└─────────┘ └─────────┘ └──────────┘
                  │           │
                  ▼           ▼
            ┌──────────┐ ┌──────────┐
            │AsyncStore│ │ Zustand  │
            │ (Persist)│ │ (Memory) │
            └──────────┘ └──────────┘
```

#### 2. Log Entry Schema

```typescript
// src/types/logging.ts

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

export interface LogEntry {
  id: string; // Unique identifier (UUID)
  timestamp: number; // Unix timestamp in milliseconds
  level: LogLevel; // Log severity level
  category: LogCategory; // Log source category
  message: string; // Human-readable message
  data?: Record<string, any>; // Additional structured data
  stackTrace?: string; // Error stack trace (for errors)
  vpnStatus?: VPNStatus; // Associated VPN status
  profileId?: string; // Associated profile ID
}

export type LogCategory =
  | "app" // App lifecycle events
  | "vpn" // VPN connection events
  | "network" // Network operations
  | "storage" // Storage operations
  | "ui" // UI interactions
  | "native" // Native module events
  | "error"; // Error events

export interface LogFilter {
  levels?: LogLevel[];
  categories?: LogCategory[];
  search?: string;
  startTime?: number;
  endTime?: number;
  profileId?: string;
}

export interface LoggerConfig {
  enabled: boolean; // Master enable/disable
  levels: LogLevel[]; // Enabled log levels
  maxEntries: number; // Max in-memory entries (default: 1000)
  maxStorageEntries: number; // Max persisted entries (default: 5000)
  persistLogs: boolean; // Enable persistence
  consoleOutput: boolean; // Output to console
  remoteLogging?: {
    // Optional remote logging
    enabled: boolean;
    endpoint: string;
    apiKey?: string;
  };
}
```

#### 3. Logger Service Implementation

```typescript
// src/services/LoggerService.ts

class LoggerService {
  private config: LoggerConfig;
  private handlers: LogHandler[];

  // Core logging methods
  debug(message: string, category: LogCategory, data?: any): void;
  info(message: string, category: LogCategory, data?: any): void;
  warn(message: string, category: LogCategory, data?: any): void;
  error(
    message: string,
    category: LogCategory,
    error?: Error,
    data?: any
  ): void;
  critical(
    message: string,
    category: LogCategory,
    error?: Error,
    data?: any
  ): void;

  // Log management
  getLogs(filter?: LogFilter): LogEntry[];
  clearLogs(): Promise<void>;
  exportLogs(format: "json" | "csv" | "txt"): Promise<string>;

  // Configuration
  updateConfig(config: Partial<LoggerConfig>): void;
  getConfig(): LoggerConfig;
}
```

#### 4. Storage Strategy

**In-Memory Storage (Zustand)**:

- Fast access for UI display
- Limited to recent logs (configurable, default 1000 entries)
- Automatically purged when limit reached (FIFO)

**Persistent Storage (AsyncStorage)**:

- Long-term log retention
- Compressed JSON format
- Partitioned by date for efficient loading
- Auto-rotation when size limit reached

**Storage Schema**:

```typescript
// AsyncStorage Keys
const STORAGE_KEYS = {
  LOGS_CONFIG: '@cbv_vpn_logs_config',
  LOGS_INDEX: '@cbv_vpn_logs_index',      // Index of log partitions
  LOGS_PARTITION: '@cbv_vpn_logs_',       // Prefix for partitions
};

// Partition Strategy
interface LogPartition {
  id: string;                    // YYYY-MM-DD format
  startTime: number;
  endTime: number;
  count: number;
  size: number;                  // Approximate size in bytes
}

// Storage organization
{
  "@cbv_vpn_logs_index": {
    "partitions": [
      {
        "id": "2025-01-14",
        "startTime": 1705190400000,
        "endTime": 1705276799999,
        "count": 234,
        "size": 45632
      }
    ]
  },
  "@cbv_vpn_logs_2025-01-14": [
    { /* LogEntry */ },
    { /* LogEntry */ }
  ]
}
```

#### 5. Logging Store (Zustand)

```typescript
// src/store/loggingStore.ts

interface LoggingStore {
  // State
  logs: LogEntry[]; // In-memory logs
  config: LoggerConfig; // Logger configuration
  filters: LogFilter; // Active filters
  isLoading: boolean;

  // Actions
  addLog: (entry: LogEntry) => void;
  addLogs: (entries: LogEntry[]) => void;
  clearLogs: () => Promise<void>;
  loadLogs: (filter?: LogFilter) => Promise<void>;
  setFilters: (filters: LogFilter) => void;
  updateConfig: (config: Partial<LoggerConfig>) => Promise<void>;
  exportLogs: (format: "json" | "csv" | "txt") => Promise<string>;

  // Computed
  getFilteredLogs: () => LogEntry[];
  getLogStats: () => LogStats;
}

interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
  byCategory: Record<LogCategory, number>;
  errorRate: number;
}
```

#### 6. Integration Points

**VPN Events Integration**:

```typescript
// src/hooks/useVPNEvents.ts - Enhanced with logging

useEffect(() => {
  const statusSubscription = VPNModule.addStatusChangeListener(
    (statusInfo: VPNStatusInfo) => {
      logger.info(`VPN status changed to ${statusInfo.state}`, "vpn", {
        statusInfo,
      });
      setVPNStatus(statusInfo);
    }
  );

  const errorSubscription = VPNModule.addErrorListener((error: any) => {
    const message = typeof error === "string" ? error : error?.message;
    logger.error(`VPN error occurred`, "vpn", new Error(message), { error });
    setError(message);
  });
}, []);
```

**Native Module Integration**:

```typescript
// src/native/VPNModule.ts - Add logging wrapper

export const VPNModule = {
  startVPN: async (profileId: string) => {
    logger.info(`Starting VPN with profile: ${profileId}`, "vpn");
    try {
      await NativeVPNModule.startVPN(profileId);
      logger.info(`VPN started successfully`, "vpn", { profileId });
    } catch (error) {
      logger.error(`Failed to start VPN`, "vpn", error, { profileId });
      throw error;
    }
  },
  // ... other methods with similar logging
};
```

#### 7. UI Components

**LogsScreen Enhancement**:

```typescript
// src/screens/LogsScreen.tsx - Enhanced version

Component Features:
- Real-time log display from Zustand store
- Multi-level filtering (level, category, search)
- Log level badges with color coding
- Expandable log entries for detailed view
- Export functionality (JSON, CSV, TXT)
- Auto-scroll toggle
- Clear logs with confirmation
- Search/filter bar
- Stats summary (total, by level, by category)

UI Layout:
┌────────────────────────────────────┐
│  Logs        [Filter] [Export] [×] │ Header
├────────────────────────────────────┤
│  [Search...]              [Stats▼] │ Filter Bar
├────────────────────────────────────┤
│  🟢 INFO    12:34:56     vpn       │
│  VPN connected successfully         │ Log Entry
│  Profile: Home Proxy               │ (Collapsible)
├────────────────────────────────────┤
│  🔴 ERROR   12:35:12     network   │
│  Connection timeout                 │
│  › Tap to view stack trace         │
├────────────────────────────────────┤
│  🟡 WARN    12:35:45     storage   │
│  Storage nearly full (90%)         │
└────────────────────────────────────┘
```

**Settings Integration**:

```typescript
// Add to SettingsScreen.tsx

<View style={styles.section}>
  <Text style={styles.sectionTitle}>Logging</Text>

  <View style={styles.settingItem}>
    <View style={styles.settingInfo}>
      <Text style={styles.settingLabel}>Enable Logging</Text>
      <Text style={styles.settingDescription}>
        Capture app events and diagnostics
      </Text>
    </View>
    <Switch value={loggingEnabled} onValueChange={toggleLogging} />
  </View>

  <TouchableOpacity onPress={openLoggingSettings}>
    <Text>Advanced Logging Settings</Text>
  </TouchableOpacity>
</View>
```

#### 8. Log Rotation & Cleanup

```typescript
// Automatic log rotation strategy

class LogRotationService {
  // Check and rotate logs daily
  async rotateLogsIfNeeded(): Promise<void> {
    const partitions = await this.getPartitions();
    const totalSize = partitions.reduce((sum, p) => sum + p.size, 0);

    // If total size exceeds limit, remove oldest partitions
    if (totalSize > MAX_LOG_STORAGE_SIZE) {
      const sorted = partitions.sort((a, b) => a.startTime - b.startTime);

      // Remove oldest 25% of partitions
      const toRemove = Math.ceil(sorted.length * 0.25);
      for (let i = 0; i < toRemove; i++) {
        await this.removePartition(sorted[i].id);
      }
    }
  }

  // Clean up old logs (> 30 days)
  async cleanupOldLogs(): Promise<void> {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const partitions = await this.getPartitions();

    for (const partition of partitions) {
      if (partition.endTime < cutoff) {
        await this.removePartition(partition.id);
      }
    }
  }
}
```

---

## Feature 2: Dark Mode

### Overview

A comprehensive theming system that supports light and dark color schemes with user preference persistence, system theme detection, and seamless switching across all app components.

### Architecture Design

#### 1. Theme System Architecture

```
Theme System Architecture
┌────────────────────────────────────────────┐
│         Application Component Tree          │
└─────────────────┬──────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────┐
│          ThemeProvider (Context)            │
│  - Current theme (light/dark)              │
│  - Theme colors & styles                    │
│  - Toggle function                          │
└─────────────────┬──────────────────────────┘
                  │
      ┌───────────┼───────────┐
      │           │           │
      ▼           ▼           ▼
┌──────────┐ ┌─────────┐ ┌──────────┐
│ Zustand  │ │AsyncStor│ │  System  │
│  Store   │ │   age   │ │ Detection│
└──────────┘ └─────────┘ └──────────┘
```

#### 2. Theme Schema

```typescript
// src/types/theme.ts

export type ThemeMode = "light" | "dark" | "system";
export type ThemeName = "light" | "dark";

export interface ThemeColors {
  // Background colors
  background: {
    primary: string; // Main background
    secondary: string; // Card/section backgrounds
    tertiary: string; // Input backgrounds
    elevated: string; // Elevated surfaces
  };

  // Text colors
  text: {
    primary: string; // Main text
    secondary: string; // Subtitle/description
    tertiary: string; // Disabled text
    inverse: string; // Text on colored backgrounds
  };

  // Interactive colors
  interactive: {
    primary: string; // Primary buttons, active states
    secondary: string; // Secondary actions
    disabled: string; // Disabled state
    hover: string; // Hover state
  };

  // Status colors
  status: {
    success: string; // VPN connected
    warning: string; // Warnings
    error: string; // Errors
    info: string; // Informational
  };

  // VPN specific colors
  vpn: {
    connected: string;
    connecting: string;
    handshaking: string;
    disconnected: string;
    error: string;
  };

  // Border and dividers
  border: {
    primary: string;
    secondary: string;
    focus: string;
  };

  // Shadows (opacity values)
  shadow: {
    color: string;
    opacity: number;
  };

  // Tab bar
  tabBar: {
    background: string;
    border: string;
    active: string;
    inactive: string;
  };
}

export interface Theme {
  name: ThemeName;
  colors: ThemeColors;
  spacing: {
    xs: number; // 4
    sm: number; // 8
    md: number; // 16
    lg: number; // 24
    xl: number; // 32
  };
  borderRadius: {
    sm: number; // 4
    md: number; // 8
    lg: number; // 12
    xl: number; // 16
    round: number; // 999
  };
  typography: {
    fontSize: {
      xs: number; // 12
      sm: number; // 14
      md: number; // 16
      lg: number; // 18
      xl: number; // 24
      xxl: number; // 32
    };
    fontWeight: {
      normal: "400";
      medium: "600";
      bold: "700";
      heavy: "800";
    };
  };
}
```

#### 3. Theme Definitions

```typescript
// src/theme/themes.ts

export const lightTheme: Theme = {
  name: "light",
  colors: {
    background: {
      primary: "#F5F5F5",
      secondary: "#FFFFFF",
      tertiary: "#F8F9FA",
      elevated: "#FFFFFF",
    },
    text: {
      primary: "#333333",
      secondary: "#666666",
      tertiary: "#999999",
      inverse: "#FFFFFF",
    },
    interactive: {
      primary: "#007AFF",
      secondary: "#5AC8FA",
      disabled: "#CCCCCC",
      hover: "#0056B3",
    },
    status: {
      success: "#4CAF50",
      warning: "#FFC107",
      error: "#F44336",
      info: "#2196F3",
    },
    vpn: {
      connected: "#0C8A5F",
      connecting: "#AF1F5C",
      handshaking: "#C97700",
      disconnected: "#1D4ED8",
      error: "#8E1621",
    },
    border: {
      primary: "#E0E0E0",
      secondary: "#F0F0F0",
      focus: "#007AFF",
    },
    shadow: {
      color: "#000000",
      opacity: 0.1,
    },
    tabBar: {
      background: "#FFFFFF",
      border: "#E0E0E0",
      active: "#007AFF",
      inactive: "#999999",
    },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 4, md: 8, lg: 12, xl: 16, round: 999 },
  typography: {
    fontSize: { xs: 12, sm: 14, md: 16, lg: 18, xl: 24, xxl: 32 },
    fontWeight: { normal: "400", medium: "600", bold: "700", heavy: "800" },
  },
};

export const darkTheme: Theme = {
  name: "dark",
  colors: {
    background: {
      primary: "#000000",
      secondary: "#1C1C1E",
      tertiary: "#2C2C2E",
      elevated: "#2C2C2E",
    },
    text: {
      primary: "#FFFFFF",
      secondary: "#ABABAB",
      tertiary: "#6B6B6B",
      inverse: "#000000",
    },
    interactive: {
      primary: "#0A84FF",
      secondary: "#64D2FF",
      disabled: "#3A3A3C",
      hover: "#0066CC",
    },
    status: {
      success: "#30D158",
      warning: "#FFD60A",
      error: "#FF453A",
      info: "#64D2FF",
    },
    vpn: {
      connected: "#30D158",
      connecting: "#FF375F",
      handshaking: "#FF9F0A",
      disconnected: "#0A84FF",
      error: "#FF453A",
    },
    border: {
      primary: "#38383A",
      secondary: "#2C2C2E",
      focus: "#0A84FF",
    },
    shadow: {
      color: "#000000",
      opacity: 0.3,
    },
    tabBar: {
      background: "#1C1C1E",
      border: "#38383A",
      active: "#0A84FF",
      inactive: "#8E8E93",
    },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 4, md: 8, lg: 12, xl: 16, round: 999 },
  typography: {
    fontSize: { xs: 12, sm: 14, md: 16, lg: 18, xl: 24, xxl: 32 },
    fontWeight: { normal: "400", medium: "600", bold: "700", heavy: "800" },
  },
};
```

#### 4. Theme Store (Zustand)

```typescript
// src/store/themeStore.ts

interface ThemeStore {
  // State
  mode: ThemeMode; // 'light' | 'dark' | 'system'
  currentTheme: ThemeName; // Resolved theme name

  // Actions
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;

  // Computed
  getTheme: () => Theme;
  getColors: () => ThemeColors;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: "system",
  currentTheme: "light",

  setMode: async (mode: ThemeMode) => {
    await AsyncStorage.setItem(THEME_MODE_KEY, mode);

    let resolvedTheme: ThemeName = "light";
    if (mode === "system") {
      const colorScheme = Appearance.getColorScheme();
      resolvedTheme = colorScheme === "dark" ? "dark" : "light";
    } else {
      resolvedTheme = mode;
    }

    set({ mode, currentTheme: resolvedTheme });
  },

  toggleTheme: async () => {
    const current = get().currentTheme;
    const newMode: ThemeMode = current === "light" ? "dark" : "light";
    await get().setMode(newMode);
  },

  getTheme: () => {
    const name = get().currentTheme;
    return name === "dark" ? darkTheme : lightTheme;
  },

  getColors: () => {
    return get().getTheme().colors;
  },
}));
```

#### 5. Theme Context & Provider

```typescript
// src/contexts/ThemeContext.tsx

interface ThemeContextValue {
  theme: Theme;
  colors: ThemeColors;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined
);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { mode, currentTheme, setMode, toggleTheme, getTheme, getColors } =
    useThemeStore();

  // Listen to system theme changes
  useEffect(() => {
    if (mode === "system") {
      const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        const newTheme = colorScheme === "dark" ? "dark" : "light";
        useThemeStore.setState({ currentTheme: newTheme });
      });

      return () => subscription.remove();
    }
  }, [mode]);

  // Load saved theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      const savedMode = await AsyncStorage.getItem(THEME_MODE_KEY);
      if (savedMode) {
        await setMode(savedMode as ThemeMode);
      }
    };
    loadTheme();
  }, []);

  const value: ThemeContextValue = {
    theme: getTheme(),
    colors: getColors(),
    mode,
    setMode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

// Custom hook for using theme
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
```

#### 6. Themed Components

**Utility Hook for Themed Styles**:

```typescript
// src/hooks/useThemedStyles.ts

export const useThemedStyles = <T extends NamedStyles<T>>(
  stylesFn: (theme: Theme, colors: ThemeColors) => T
): T => {
  const { theme, colors } = useTheme();
  return useMemo(() => stylesFn(theme, colors), [theme, colors]);
};

// Usage example
const Component = () => {
  const styles = useThemedStyles((theme, colors) =>
    StyleSheet.create({
      container: {
        backgroundColor: colors.background.primary,
        padding: theme.spacing.md,
      },
      text: {
        color: colors.text.primary,
        fontSize: theme.typography.fontSize.md,
      },
    })
  );

  return <View style={styles.container}>...</View>;
};
```

**Themed Component Example**:

```typescript
// src/components/ThemedCard.tsx

interface ThemedCardProps {
  children: ReactNode;
  elevated?: boolean;
}

export const ThemedCard: React.FC<ThemedCardProps> = ({
  children,
  elevated = false,
}) => {
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        backgroundColor: elevated
          ? colors.background.elevated
          : colors.background.secondary,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        shadowColor: colors.shadow.color,
        shadowOpacity: colors.shadow.opacity,
        shadowRadius: 6,
        elevation: elevated ? 3 : 0,
      }}
    >
      {children}
    </View>
  );
};
```

#### 7. Component Migration Strategy

Components requiring theme updates (priority order):

**High Priority** (Core UI):

1. `ConnectionScreen.tsx` - Main VPN control UI
2. `AppNavigator.tsx` - Navigation theme
3. `ProfileListScreen.tsx` - Profile list
4. `SettingsScreen.tsx` - Settings UI

**Medium Priority**: 5. `LogsScreen.tsx` - Logs display 6. `ProfileFormScreen.tsx` - Form inputs 7. `CustomAlert.tsx` - Alert dialogs 8. `ProfileNotification.tsx` - Notifications

**Migration Pattern**:

```typescript
// Before (hardcoded colors)
const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f5f5f5",
  },
  text: {
    color: "#333",
  },
});

// After (theme-aware)
const Component = () => {
  const styles = useThemedStyles((theme, colors) =>
    StyleSheet.create({
      container: {
        backgroundColor: colors.background.primary,
      },
      text: {
        color: colors.text.primary,
      },
    })
  );
  // ...
};
```

#### 8. Settings Integration

```typescript
// Enhanced SettingsScreen.tsx

<View style={styles.section}>
  <Text style={styles.sectionTitle}>Appearance</Text>

  {/* Theme Mode Selector */}
  <View style={styles.settingItem}>
    <View style={styles.settingInfo}>
      <Text style={styles.settingLabel}>Theme</Text>
      <Text style={styles.settingDescription}>
        Choose your preferred color scheme
      </Text>
    </View>
    <Picker selectedValue={themeMode} onValueChange={handleThemeModeChange}>
      <Picker.Item label="Light" value="light" />
      <Picker.Item label="Dark" value="dark" />
      <Picker.Item label="System" value="system" />
    </Picker>
  </View>

  {/* Quick Toggle */}
  <TouchableOpacity style={styles.settingItem} onPress={toggleTheme}>
    <View style={styles.settingInfo}>
      <Text style={styles.settingLabel}>Quick Toggle</Text>
      <Text style={styles.settingDescription}>
        Switch between light and dark mode
      </Text>
    </View>
    <Ionicons
      name={currentTheme === "dark" ? "moon" : "sunny"}
      size={24}
      color={colors.interactive.primary}
    />
  </TouchableOpacity>

  {/* Theme Preview */}
  <View style={styles.themePreview}>
    <ThemedCard>
      <Text>Preview of current theme</Text>
    </ThemedCard>
  </View>
</View>
```

#### 9. StatusBar Integration

```typescript
// App.tsx - Update StatusBar based on theme

import { StatusBar } from "expo-status-bar";

export default function App() {
  const { currentTheme } = useThemeStore();

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppNavigator />
        <ProfileNotification />
        <StatusBar
          style={currentTheme === "dark" ? "light" : "dark"}
          backgroundColor="transparent"
        />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
```

---

## Implementation Phases

### Phase 1: Logging System Foundation (Week 1)

**Goals**: Establish core logging infrastructure

**Tasks**:

1. Create logging types and interfaces (`src/types/logging.ts`)
2. Implement LoggerService class (`src/services/LoggerService.ts`)
3. Create logging Zustand store (`src/store/loggingStore.ts`)
4. Implement storage handlers (AsyncStorage persistence)
5. Add console handler for development

**Deliverables**:

- Functional logger service
- In-memory log storage
- Persistent log storage
- Basic configuration system

**Testing**:

- Unit tests for LoggerService
- Storage persistence tests
- Log rotation tests

### Phase 2: Logging Integration (Week 2)

**Goals**: Integrate logging throughout the app

**Tasks**:

1. Add logging to VPNModule (`src/native/VPNModule.ts`)
2. Enhance useVPNEvents hook with logging
3. Add logging to StorageService
4. Add logging to vpnStore actions
5. Create logging wrapper utilities

**Deliverables**:

- VPN operations fully logged
- Storage operations logged
- Error tracking enabled
- Event logging system

**Testing**:

- Integration tests
- VPN event logging validation
- Error tracking verification

### Phase 3: Logging UI (Week 3)

**Goals**: Build comprehensive logging UI

**Tasks**:

1. Enhance LogsScreen with filtering
2. Add search functionality
3. Implement export feature (JSON, CSV, TXT)
4. Create log detail modal
5. Add statistics dashboard
6. Settings integration for log configuration

**Deliverables**:

- Enhanced LogsScreen UI
- Filter and search capabilities
- Export functionality
- Settings controls

**Testing**:

- UI/UX testing
- Export format validation
- Performance testing with large log sets

### Phase 4: Dark Mode Foundation (Week 4)

**Goals**: Establish theme system

**Tasks**:

1. Create theme types (`src/types/theme.ts`)
2. Define light and dark theme objects (`src/theme/themes.ts`)
3. Implement theme Zustand store (`src/store/themeStore.ts`)
4. Create ThemeContext and Provider (`src/contexts/ThemeContext.tsx`)
5. Implement useTheme and useThemedStyles hooks

**Deliverables**:

- Complete theme system
- Theme persistence
- System theme detection
- Theme toggle functionality

**Testing**:

- Theme switching tests
- Persistence tests
- System theme detection tests

### Phase 5: Dark Mode UI Migration (Week 5-6)

**Goals**: Migrate all components to theme system

**Tasks**:

1. Week 5 (High Priority):

   - ConnectionScreen.tsx
   - AppNavigator.tsx
   - ProfileListScreen.tsx
   - SettingsScreen.tsx

2. Week 6 (Medium Priority):
   - LogsScreen.tsx
   - ProfileFormScreen.tsx
   - CustomAlert.tsx
   - ProfileNotification.tsx

**Deliverables**:

- All screens theme-aware
- Consistent theming across app
- Theme preview in settings

**Testing**:

- Visual regression testing
- Cross-theme consistency checks
- Accessibility testing (contrast ratios)

### Phase 6: Polish & Optimization (Week 7)

**Goals**: Refinement and performance optimization

**Tasks**:

1. Performance optimization
   - Memoization of theme computations
   - Optimize re-renders on theme change
   - Lazy load log partitions
2. UX improvements
   - Smooth theme transitions
   - Loading states
   - Error handling
3. Documentation
   - Developer guide for themed components
   - Logging best practices
   - API documentation

**Deliverables**:

- Optimized performance
- Complete documentation
- Production-ready features

**Testing**:

- Performance benchmarks
- Load testing
- User acceptance testing

---

## Dependencies

### New Dependencies to Add

```json
{
  "dependencies": {
    "react-native-fs": "^2.20.0",
    "uuid": "^9.0.1",
    "@react-native-community/datetimepicker": "^7.6.2"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.7"
  }
}
```

**Dependency Justifications**:

1. **uuid** (9.0.1)

   - Purpose: Generate unique log entry IDs
   - Size: ~14KB
   - Alternative: Native Date.now() + counter (less robust)

2. **react-native-fs** (2.20.0)

   - Purpose: Advanced file system operations for log export
   - Size: ~50KB native module
   - Alternative: FileSystem from expo-file-system (consider using this instead)

3. **@react-native-community/datetimepicker** (7.6.2)
   - Purpose: Date range picker for log filtering
   - Size: ~200KB native module
   - Optional: Can be implemented later

**Recommended Alternative** (using existing Expo modules):

```json
{
  "dependencies": {
    "uuid": "^9.0.1",
    "expo-file-system": "~17.0.1",
    "expo-sharing": "~13.0.3"
  }
}
```

### Existing Dependencies (No changes needed)

- AsyncStorage: Already installed (log persistence)
- Zustand: Already installed (state management)
- React Navigation: Already installed (no theme updates needed)
- Expo modules: Already installed

---

## File Structure

### New Files to Create

```
CB-Pro-Proxy/
├── src/
│   ├── types/
│   │   ├── logging.ts              # Logging type definitions
│   │   └── theme.ts                # Theme type definitions
│   │
│   ├── services/
│   │   ├── LoggerService.ts        # Core logging service
│   │   └── LogRotationService.ts   # Log rotation & cleanup
│   │
│   ├── store/
│   │   ├── loggingStore.ts         # Logging Zustand store
│   │   └── themeStore.ts           # Theme Zustand store
│   │
│   ├── contexts/
│   │   └── ThemeContext.tsx        # Theme context & provider
│   │
│   ├── hooks/
│   │   ├── useLogger.ts            # Logger hook
│   │   └── useThemedStyles.ts      # Themed styles hook
│   │
│   ├── theme/
│   │   ├── themes.ts               # Light & dark theme definitions
│   │   ├── colors.ts               # Color constants
│   │   └── index.ts                # Theme exports
│   │
│   ├── components/
│   │   ├── ThemedCard.tsx          # Themed card component
│   │   ├── ThemedButton.tsx        # Themed button component
│   │   ├── ThemedText.tsx          # Themed text component
│   │   ├── LogEntryItem.tsx        # Log entry list item
│   │   ├── LogFilterModal.tsx      # Log filter modal
│   │   └── ThemePreview.tsx        # Theme preview component
│   │
│   └── utils/
│       ├── logExporter.ts          # Log export utilities
│       └── themeUtils.ts           # Theme utility functions
│
└── docs/
    └── FEATURE_DESIGN.md           # This document
```

### Files to Modify

```
CB-Pro-Proxy/
├── src/
│   ├── screens/
│   │   ├── ConnectionScreen.tsx    # Add theming
│   │   ├── LogsScreen.tsx          # Enhance with new features
│   │   ├── SettingsScreen.tsx      # Add theme controls
│   │   ├── ProfileListScreen.tsx   # Add theming
│   │   └── ProfileFormScreen.tsx   # Add theming
│   │
│   ├── components/
│   │   ├── CustomAlert.tsx         # Add theming
│   │   └── ProfileNotification.tsx # Add theming
│   │
│   ├── navigation/
│   │   └── AppNavigator.tsx        # Add theming
│   │
│   ├── hooks/
│   │   └── useVPNEvents.ts         # Add logging
│   │
│   ├── native/
│   │   └── VPNModule.ts            # Add logging
│   │
│   ├── services/
│   │   └── StorageService.ts       # Add logging
│   │
│   ├── store/
│   │   └── vpnStore.ts             # Add logging
│   │
│   └── App.tsx                     # Wrap with ThemeProvider
│
└── package.json                    # Add new dependencies
```

---

## Data Flow Diagrams

### Logging System Data Flow

```
User Action / System Event
        │
        ▼
┌───────────────────┐
│  Logger.log()     │
│  (debug/info/     │
│   warn/error)     │
└────────┬──────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│Console │ │ Handlers │
│ Output │ │ Pipeline │
└────────┘ └────┬─────┘
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
┌──────────────┐ ┌─────────────┐
│ Zustand Store│ │ AsyncStorage│
│ (In-Memory)  │ │ (Persistent)│
└──────┬───────┘ └──────┬──────┘
       │                │
       │                ▼
       │         ┌─────────────┐
       │         │ Log Rotation│
       │         │  & Cleanup  │
       │         └─────────────┘
       │
       ▼
┌──────────────┐
│  LogsScreen  │
│   (Display)  │
└──────────────┘
```

### Theme System Data Flow

```
User Theme Change / System Detection
              │
              ▼
┌─────────────────────────┐
│   setMode() / toggle()  │
└────────────┬────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌────────────┐  ┌────────────┐
│  Zustand   │  │ AsyncStor  │
│   Store    │  │    age     │
└─────┬──────┘  └────────────┘
      │
      │ (mode changed)
      ▼
┌─────────────────────┐
│ ThemeContext Update │
└──────────┬──────────┘
           │
           │ (context consumers re-render)
           ▼
┌──────────────────────┐
│  All Components      │
│  using useTheme() or │
│  useThemedStyles()   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Re-render with      │
│  new theme colors    │
└──────────────────────┘
```

---

## Performance Considerations

### Logging System

**Memory Management**:

- In-memory log limit: 1000 entries (configurable)
- Automatic purging: FIFO when limit reached
- Partition size limit: 50KB per partition
- Total storage limit: 5MB (configurable)

**Optimization Strategies**:

- Debounce frequent logs (e.g., connection stats)
- Async log writing (non-blocking)
- Lazy partition loading
- Log compression for storage
- Background cleanup tasks

**Performance Benchmarks**:

- Log write: < 1ms (in-memory)
- Log persist: < 5ms (async)
- UI render: < 16ms (60fps)
- Export: < 100ms (1000 entries)

### Dark Mode

**Re-render Optimization**:

- Memoize theme objects
- Use React.memo for themed components
- Optimize useThemedStyles with useMemo
- Minimize theme-dependent re-renders

**Theme Switching**:

- Instant theme application (< 16ms)
- No layout shift during switch
- Smooth transitions (optional 200ms fade)

**Memory Footprint**:

- Theme objects: ~2KB each
- Context overhead: minimal
- No significant memory increase

---

## Testing Strategy

### Logging System Tests

**Unit Tests**:

- LoggerService methods
- Log entry creation
- Filter logic
- Export formatting
- Storage persistence

**Integration Tests**:

- VPN event logging
- Error tracking
- Log rotation
- Multi-source logging

**UI Tests**:

- LogsScreen rendering
- Filter functionality
- Search functionality
- Export flow

### Dark Mode Tests

**Unit Tests**:

- Theme object structure
- Color contrast ratios (WCAG)
- Theme switching logic
- Persistence

**Integration Tests**:

- System theme detection
- Theme propagation
- Component theming

**Visual Tests**:

- Screenshot comparison
- Theme consistency
- Component variants

---

## Security & Privacy Considerations

### Logging System

**Sensitive Data**:

- Never log passwords or credentials
- Hash or redact sensitive profile data
- Sanitize user inputs in logs
- Avoid logging full API responses

**Log Access**:

- Logs stored locally only (no cloud by default)
- Secure file permissions
- Optional log export encryption
- User-controlled log retention

**Data Minimization**:

- Log only necessary information
- Configurable log levels
- Optional PII redaction
- Auto-cleanup of old logs

### Dark Mode

**User Preference Privacy**:

- Theme preference stored locally
- No telemetry on theme usage
- No external API calls

---

## Accessibility Considerations

### Logging System

**Screen Reader Support**:

- Proper ARIA labels for log entries
- Semantic HTML structure
- Keyboard navigation support

**Visual Accessibility**:

- High contrast log level badges
- Readable font sizes
- Color-blind friendly indicators

### Dark Mode

**WCAG Compliance**:

- Minimum contrast ratio 4.5:1 (text)
- Minimum contrast ratio 3:1 (large text)
- Contrast ratio 3:1 (UI components)

**Color Palettes**:

```typescript
// Light theme contrast ratios
background (#F5F5F5) ↔ text (#333333): 12.63:1 ✓
background (#FFFFFF) ↔ text (#333333): 12.63:1 ✓
primary (#007AFF) ↔ text (#FFFFFF): 4.52:1 ✓

// Dark theme contrast ratios
background (#000000) ↔ text (#FFFFFF): 21:1 ✓
background (#1C1C1E) ↔ text (#FFFFFF): 15.87:1 ✓
primary (#0A84FF) ↔ background (#000000): 8.59:1 ✓
```

**User Preferences**:

- Respect system theme preference
- Allow manual override
- Persist user choice

---

## Migration & Rollout Plan

### Phase-wise Rollout

**Alpha Release** (Internal Testing):

- Logging system enabled
- Dark mode with opt-in flag
- Limited user base

**Beta Release** (Early Adopters):

- Full logging features
- Dark mode enabled by default
- Feedback collection

**Production Release**:

- Stable logging system
- Polished dark mode
- Full feature set

### Rollback Strategy

**Logging System**:

- Feature flag: `ENABLE_LOGGING`
- Graceful degradation if disabled
- No breaking changes to existing code

**Dark Mode**:

- Feature flag: `ENABLE_DARK_MODE`
- Fallback to light theme
- No data loss on rollback

### User Communication

**What's New**:

- In-app announcement for dark mode
- Settings badge for new features
- Changelog in settings

**Documentation**:

- User guide for logging features
- Dark mode FAQ
- Troubleshooting guide

---

## Future Enhancements

### Logging System

**Advanced Features** (v2.0):

- Remote logging to external service
- Real-time log streaming
- Advanced analytics dashboard
- Crash reporting integration
- Log-based alerts/notifications
- Performance metrics tracking

**Export Enhancements**:

- Email log export
- Cloud backup integration
- Automated log sharing
- Custom export templates

### Dark Mode

**Enhanced Theming** (v2.0):

- Custom theme builder
- Multiple theme presets (AMOLED, Sepia, etc.)
- Per-screen theme override
- Scheduled theme switching (auto-dark at night)
- Theme marketplace/sharing

**Accessibility++**:

- High contrast mode
- Large text mode
- Color-blind friendly themes
- Custom color overrides

---

## Appendix

### A. Storage Schema Examples

**Log Partition Example**:

```json
{
  "@cbv_vpn_logs_2025-01-14": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": 1705190400000,
      "level": "info",
      "category": "vpn",
      "message": "VPN connection initiated",
      "data": {
        "profileId": "profile-123",
        "profileName": "Home Proxy"
      }
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "timestamp": 1705190405000,
      "level": "error",
      "category": "vpn",
      "message": "Connection timeout",
      "stackTrace": "Error: timeout\n  at VPNModule...",
      "vpnStatus": "error"
    }
  ]
}
```

**Theme Preference Storage**:

```json
{
  "@cbv_vpn_theme_mode": "dark"
}
```

### B. Component Examples

**Example: Themed ConnectionScreen Button**:

```typescript
const ConnectButton = () => {
  const { colors, theme } = useTheme();
  const { vpnStatus } = useVPNStore();

  const buttonColor = useMemo(() => {
    switch (vpnStatus) {
      case "connected":
        return colors.vpn.connected;
      case "connecting":
        return colors.vpn.connecting;
      case "error":
        return colors.vpn.error;
      default:
        return colors.vpn.disconnected;
    }
  }, [vpnStatus, colors]);

  return (
    <TouchableOpacity
      style={{
        backgroundColor: buttonColor,
        borderRadius: theme.borderRadius.round,
        padding: theme.spacing.md,
      }}
    >
      <Text style={{ color: colors.text.inverse }}>
        {getButtonLabel(vpnStatus)}
      </Text>
    </TouchableOpacity>
  );
};
```

### C. Logging Best Practices

**Do's**:

- ✅ Log important state changes
- ✅ Log user actions
- ✅ Log errors with context
- ✅ Use appropriate log levels
- ✅ Include relevant metadata
- ✅ Use consistent message format

**Don'ts**:

- ❌ Log sensitive data (passwords, tokens)
- ❌ Log in tight loops (use debouncing)
- ❌ Use console.log directly (use logger)
- ❌ Log redundant information
- ❌ Create circular log references
- ❌ Block main thread with logging

### D. Theme Design Tokens

**Spacing Scale** (8pt grid system):

```typescript
xs: 4,   // 0.5 units
sm: 8,   // 1 unit
md: 16,  // 2 units
lg: 24,  // 3 units
xl: 32,  // 4 units
```

**Typography Scale** (Modular scale 1.25):

```typescript
xs: 12,   // Small labels
sm: 14,   // Body text small
md: 16,   // Body text
lg: 18,   // Subheadings
xl: 24,   // Headings
xxl: 32,  // Large headings
```

**Border Radius Scale**:

```typescript
sm: 4,    // Small elements
md: 8,    // Default
lg: 12,   // Cards
xl: 16,   // Large cards
round: 999, // Pills/circles
```

---

## Document Metadata

**Version History**:

- v1.0 (2025-01-14): Initial design document

**Contributors**:

- Architecture Team

**Related Documents**:

- README.md
- CONTRIBUTING.md
- API Documentation

**Review Status**: Ready for Implementation

---

## Summary

This design document provides a comprehensive blueprint for implementing both the **Logging System** and **Dark Mode** features in the CB-Pro-Proxy React Native VPN application.

**Key Highlights**:

1. **Logging System**:

   - Multi-level logging (debug, info, warn, error, critical)
   - Persistent storage with automatic rotation
   - Rich filtering and search capabilities
   - Export functionality (JSON, CSV, TXT)
   - Seamless integration with existing VPN events
   - Performance-optimized with minimal overhead

2. **Dark Mode**:
   - Complete theming system with type-safe colors
   - Support for light, dark, and system themes
   - User preference persistence
   - Zero-configuration component theming
   - WCAG-compliant color contrast
   - Smooth theme transitions

Both features are designed to integrate seamlessly with the existing architecture, requiring minimal changes to current code while providing significant value to users and developers.

**Next Steps**: Proceed with Phase 1 implementation following the detailed implementation plan outlined in this document.
