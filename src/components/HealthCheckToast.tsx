import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useProxyHealthStore } from "../store/proxyHealthStore";
import { useTheme } from "../hooks/useTheme";

export const HealthCheckToast = () => {
  const { colors } = useTheme();
  const checkQueueLength = useProxyHealthStore((s) => s.checkQueue.length);
  const isProcessingQueue = useProxyHealthStore((s) => s.isProcessingQueue);
  const isChecking = useProxyHealthStore((s) => s.isChecking.size > 0);
  
  // Animation value: 0 = hidden, 1 = visible
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isVisible = (isProcessingQueue && checkQueueLength > 0) || isChecking;

  useEffect(() => {
    if (isVisible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      // Delay hiding slightly to prevent flickering
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!isVisible && (fadeAnim as any)._value === 0) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.background.secondary,
          borderColor: colors.border.primary,
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name="pulse" size={20} color={colors.interactive.primary} />
        <Text style={[styles.text, { color: colors.text.primary }]}>
          Checking health... {checkQueueLength > 0 ? `(${checkQueueLength} left)` : ""}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 9999,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
  },
});
