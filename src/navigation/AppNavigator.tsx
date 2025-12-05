import React, { useEffect } from "react";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  ProfileListScreen,
  ProfileFormScreen,
  ConnectionScreen,
  OnboardingScreen,
} from "../screens";
import { LogsScreen } from "../screens/LogsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { useOnboardingStore } from "../store/onboardingStore";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: undefined;
  ProfileForm: { profile?: any } | undefined;
};

export type TabParamList = {
  Home: undefined;
  Profiles: undefined;
  Logs: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const MainTabs: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabBar.active,
        tabBarInactiveTintColor: colors.tabBar.inactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar.background,
          borderTopWidth: 1,
          borderTopColor: colors.tabBar.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={ConnectionScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profiles"
        component={ProfileListScreen}
        options={{
          tabBarLabel: "Profiles",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "people" : "people-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Logs"
        component={LogsScreen}
        options={{
          tabBarLabel: "Logs",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "document-text" : "document-text-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "settings" : "settings-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// Wrapper component for OnboardingScreen to handle navigation
const OnboardingWrapper: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { completeOnboarding } = useOnboardingStore();

  const handleComplete = async () => {
    await completeOnboarding();
    navigation.reset({
      index: 0,
      routes: [{ name: "MainTabs" }],
    });
  };

  return <OnboardingScreen navigation={navigation} onComplete={handleComplete} />;
};

export const AppNavigator: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { hasCompletedOnboarding, isLoading, loadOnboardingStatus } = useOnboardingStore();

  useEffect(() => {
    loadOnboardingStatus();
  }, []);

  // Create custom navigation theme based on current theme
  const navigationTheme = {
    dark: isDark,
    colors: {
      primary: colors.interactive.primary,
      background: colors.background.primary,
      card: colors.background.secondary,
      text: colors.text.primary,
      border: colors.border.primary,
      notification: colors.status.error,
    },
    fonts: DefaultTheme.fonts,
  };

  // Show loading screen while checking onboarding status
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.interactive.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.interactive.primary,
          },
          headerTintColor: colors.text.inverse,
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
        initialRouteName={hasCompletedOnboarding ? "MainTabs" : "Onboarding"}
      >
        <Stack.Screen
          name="Onboarding"
          component={OnboardingWrapper}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="ProfileForm"
          component={ProfileFormScreen}
          options={({ route }) => ({
            title: route.params?.profile ? "Edit Profile" : "Add Profile",
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
