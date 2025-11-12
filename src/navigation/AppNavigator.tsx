import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
    ProfileListScreen,
    ProfileFormScreen,
    ConnectionScreen,
} from '../screens';
import { LogsScreen } from '../screens/LogsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export type RootStackParamList = {
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
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#007AFF',
                tabBarInactiveTintColor: '#999',
                tabBarStyle: {
                    backgroundColor: '#fff',
                    borderTopWidth: 1,
                    borderTopColor: '#e0e0e0',
                    height: 60 + insets.bottom,
                    paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
                    paddingTop: 8,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '600',
                },
            }}
        >
            <Tab.Screen
                name="Home"
                component={ConnectionScreen}
                options={{
                    tabBarLabel: 'Home',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Profiles"
                component={ProfileListScreen}
                options={{
                    tabBarLabel: 'Profiles',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons
                            name={focused ? 'people' : 'people-outline'}
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
                    tabBarLabel: 'Logs',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons
                            name={focused ? 'document-text' : 'document-text-outline'}
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
                    tabBarLabel: 'Settings',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
};

export const AppNavigator: React.FC = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerStyle: {
                        backgroundColor: '#007AFF',
                    },
                    headerTintColor: '#fff',
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                }}
            >
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
                        title: route.params?.profile ? 'Edit Profile' : 'Add Profile',
                    })}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
};
