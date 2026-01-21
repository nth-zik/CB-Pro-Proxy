import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../hooks/useTheme";
import { VPNModule } from "../native";
import type { Theme } from "../types/theme";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  action: () => Promise<boolean>;
  isOptional?: boolean;
}

interface OnboardingScreenProps {
  navigation: any;
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  navigation,
  onComplete,
}) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [stepStatuses, setStepStatuses] = useState<Record<string, "pending" | "processing" | "completed" | "skipped" | "error">>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  const withTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string
  ): Promise<T> => {
    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(message));
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  };

  const isIOS = Platform.OS === "ios";
  const steps: OnboardingStep[] = [
    {
      id: "vpn_permission",
      title: "VPN Permission",
      description: isIOS
        ? "iOS will request VPN permission on your first connection."
        : "Allow this app to create VPN connections for secure proxy tunneling. A system dialog will appear to confirm.",
      icon: "shield-checkmark",
      action: async () => {
        try {
          if (isIOS) {
            return true;
          }
          // This triggers the VPN permission dialog (same as when pressing Connect)
          const result = await withTimeout(
            VPNModule.prepareVPN(),
            12000,
            "VPN permission request timed out"
          );
          return result === true;
        } catch (error: any) {
          // User denied permission
          if (error?.code === "VPN_PERMISSION_DENIED") {
            console.log("VPN permission denied by user");
            return false;
          }
          console.warn("VPN permission request failed:", error);
          return false;
        }
      },
    },
    {
      id: "notification_permission",
      title: "Notification Permission",
      description: "Enable notifications to receive connection status updates and alerts.",
      icon: "notifications",
      action: async () => {
        if (Platform.OS === "android" && Platform.Version >= 33) {
          try {
            const granted = await PermissionsAndroid.request(
              "android.permission.POST_NOTIFICATIONS" as any
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
          } catch (error) {
            console.warn("Notification permission request failed:", error);
            return false;
          }
        }
        // For older Android versions, permission is granted by default
        return true;
      },
      isOptional: true,
    },
  ];

  useEffect(() => {
    // Initialize step statuses
    const initialStatuses: Record<string, "pending" | "processing" | "completed" | "skipped" | "error"> = {};
    steps.forEach((step) => {
      initialStatuses[step.id] = "pending";
    });
    setStepStatuses(initialStatuses);

    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleStepAction = async (step: OnboardingStep) => {
    setIsProcessing(true);
    setStepStatuses((prev) => ({ ...prev, [step.id]: "processing" }));

    try {
      const success = await step.action();
      setStepStatuses((prev) => ({
        ...prev,
        [step.id]: success ? "completed" : "error",
      }));
    } catch (error) {
      console.error(`Error in step ${step.id}:`, error);
      setStepStatuses((prev) => ({ ...prev, [step.id]: "error" }));
    }

    setIsProcessing(false);
  };

  const handleSkipStep = (step: OnboardingStep) => {
    setStepStatuses((prev) => ({ ...prev, [step.id]: "skipped" }));
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      // Animate transition
      Animated.sequence([
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: -30,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    onComplete();
  };

  const getStepStatusIcon = (stepId: string) => {
    const status = stepStatuses[stepId];
    switch (status) {
      case "completed":
        return <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />;
      case "skipped":
        return <Ionicons name="remove-circle" size={24} color={colors.text.tertiary} />;
      case "error":
        return <Ionicons name="close-circle" size={24} color={colors.status.error} />;
      case "processing":
        return <ActivityIndicator size="small" color={colors.interactive.primary} />;
      default:
        return <View style={[styles.pendingDot, { backgroundColor: colors.border.primary }]} />;
    }
  };

  const currentStepData = steps[currentStep];
  const currentStatus = stepStatuses[currentStepData?.id];
  const canProceed = currentStatus === "completed" || currentStatus === "skipped";
  const isLastStep = currentStep === steps.length - 1;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Welcome to CB Proxy</Text>
        <Text style={styles.headerSubtitle}>
          Let's set up your app for the best experience
        </Text>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <View style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  index <= currentStep && styles.progressDotActive,
                  stepStatuses[step.id] === "completed" && styles.progressDotCompleted,
                ]}
              >
                {stepStatuses[step.id] === "completed" ? (
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                ) : (
                  <Text style={[
                    styles.progressDotText,
                    index <= currentStep && styles.progressDotTextActive,
                  ]}>
                    {index + 1}
                  </Text>
                )}
              </View>
            </View>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.progressLine,
                  index < currentStep && styles.progressLineActive,
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Step Content */}
      <Animated.View
        style={[
          styles.stepContent,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.stepIconContainer}>
          <View style={styles.stepIconBackground}>
            <Ionicons
              name={currentStepData.icon}
              size={48}
              color={colors.interactive.primary}
            />
          </View>
        </View>

        <Text style={styles.stepTitle}>{currentStepData.title}</Text>
        <Text style={styles.stepDescription}>{currentStepData.description}</Text>

        {/* Step Status */}
        <View style={styles.stepStatusContainer}>
          {getStepStatusIcon(currentStepData.id)}
          <Text style={styles.stepStatusText}>
            {currentStatus === "completed"
              ? "Permission granted"
              : currentStatus === "skipped"
              ? "Skipped"
              : currentStatus === "error"
              ? "Action required"
              : currentStatus === "processing"
              ? "Please wait..."
              : "Tap the button below"}
          </Text>
        </View>
      </Animated.View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {currentStatus !== "completed" && currentStatus !== "skipped" && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.primaryButton,
              isProcessing && styles.buttonDisabled,
            ]}
            onPress={() => handleStepAction(currentStepData)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name={currentStepData.icon}
                  size={20}
                  color="#FFFFFF"
                  style={styles.buttonIcon}
                />
                <Text style={styles.primaryButtonText}>
                  Grant {currentStepData.title}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {currentStepData.isOptional && currentStatus !== "completed" && currentStatus !== "skipped" && (
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => handleSkipStep(currentStepData)}
            disabled={isProcessing}
          >
            <Text style={styles.secondaryButtonText}>Skip for now</Text>
          </TouchableOpacity>
        )}

        {canProceed && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={handleNext}
          >
            <Text style={styles.primaryButtonText}>
              {isLastStep ? "Get Started" : "Continue"}
            </Text>
            <Ionicons
              name={isLastStep ? "checkmark-circle" : "arrow-forward"}
              size={20}
              color="#FFFFFF"
              style={styles.buttonIcon}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Skip All Button */}
      <TouchableOpacity
        style={styles.skipAllButton}
        onPress={handleComplete}
      >
        <Text style={styles.skipAllButtonText}>Skip Setup</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing.lg,
      alignItems: "center",
    },
    headerTitle: {
      fontSize: theme.typography.fontSize.xxl,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs,
    },
    headerSubtitle: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text.secondary,
      textAlign: "center",
    },
    progressContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
    },
    progressStep: {
      alignItems: "center",
    },
    progressDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.background.tertiary,
      borderWidth: 2,
      borderColor: theme.colors.border.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    progressDotActive: {
      backgroundColor: theme.colors.interactive.primary,
      borderColor: theme.colors.interactive.primary,
    },
    progressDotCompleted: {
      backgroundColor: theme.colors.status.success,
      borderColor: theme.colors.status.success,
    },
    progressDotText: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.tertiary,
    },
    progressDotTextActive: {
      color: "#FFFFFF",
    },
    progressLine: {
      width: 40,
      height: 2,
      backgroundColor: theme.colors.border.primary,
      marginHorizontal: theme.spacing.xs,
    },
    progressLineActive: {
      backgroundColor: theme.colors.status.success,
    },
    stepContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xl,
    },
    stepIconContainer: {
      marginBottom: theme.spacing.lg,
    },
    stepIconBackground: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.background.secondary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.colors.shadow.color,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme.colors.shadow.opacity,
      shadowRadius: 8,
      elevation: 4,
    },
    stepTitle: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
      textAlign: "center",
    },
    stepDescription: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text.secondary,
      textAlign: "center",
      lineHeight: 24,
      paddingHorizontal: theme.spacing.md,
    },
    stepStatusContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.background.tertiary,
      borderRadius: theme.borderRadius.md,
    },
    stepStatusText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing.sm,
    },
    pendingDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    actionsContainer: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
    },
    primaryButton: {
      backgroundColor: theme.colors.interactive.primary,
    },
    secondaryButton: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme.colors.border.primary,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonIcon: {
      marginHorizontal: theme.spacing.xs,
    },
    primaryButtonText: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
      color: "#FFFFFF",
    },
    secondaryButtonText: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text.secondary,
    },
    skipAllButton: {
      alignItems: "center",
      paddingVertical: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    skipAllButtonText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.tertiary,
    },
  });
