import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { useVPNEvents } from "./src/hooks";
import { ProfileNotification } from "./src/components";
import { ThemeProvider } from "./src/contexts/ThemeContext";
import { useThemeStore } from "./src/store/themeStore";
import { initializeLoggingStore } from "./src/store/loggingStore";
import { logger } from "./src/services/LoggerService";
import { proxySourceService } from "./src/services/ProxySourceService";

// Global error handler for unhandled errors
const setupGlobalErrorHandlers = () => {
  // Catch unhandled errors using ErrorUtils if available
  try {
    const ErrorUtils = (global as any).ErrorUtils;
    if (ErrorUtils) {
      const originalHandler = ErrorUtils.getGlobalHandler();

      ErrorUtils.setGlobalHandler((error: any, isFatal: any) => {
        console.error("🚨 UNHANDLED ERROR:", error);
        console.error("Stack:", error.stack);
        console.error("Is Fatal:", isFatal);

        // Call original handler
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }
  } catch (err) {
    console.warn("Could not setup ErrorUtils handler:", err);
  }

  // Console wrappers removed - they were causing recursive logging loops
};

function AppContent() {
  useEffect(() => {
    console.log("🚀 App initialized");

    // Initialize logging store
    initializeLoggingStore();

    // Add some test logs to verify the system
    logger.info("App started successfully", "app");
    logger.debug("Logging system initialized", "app");
    logger.info("VPN service ready", "vpn");

    // Start periodic proxy source fetch (check every hour)
    proxySourceService.startPeriodicFetch(60);

    // Test crypto availability
    try {
      if (typeof crypto === "undefined") {
        console.error("❌ crypto object is undefined");
      } else {
        console.log("✅ crypto object exists:", typeof crypto);
        if (typeof crypto.getRandomValues === "undefined") {
          console.error("❌ crypto.getRandomValues is undefined");
        } else {
          console.log("✅ crypto.getRandomValues exists");
        }
      }
    } catch (error) {
      console.error("❌ Error checking crypto:", error);
    }
  }, []);

  // Listen to VPN events
  useVPNEvents();

  // Get current theme for StatusBar
  const { currentTheme } = useThemeStore();

  return (
    <SafeAreaProvider>
      <AppNavigator />
      <ProfileNotification />
      <StatusBar
        style={currentTheme === "dark" ? "light" : "dark"}
        backgroundColor="transparent"
      />
    </SafeAreaProvider>
  );
}

export default function App() {
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
