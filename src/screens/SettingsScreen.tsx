import React from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Switch,
    Alert,
    Linking,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export const SettingsScreen: React.FC = () => {
    const [autoConnect, setAutoConnect] = React.useState(false);
    const [notifications, setNotifications] = React.useState(true);
    const [darkMode, setDarkMode] = React.useState(false);

    const handleOpenVPNSettings = async () => {
        if (Platform.OS !== 'android') {
            Alert.alert(
                'Not Supported',
                'Always-on VPN configuration is only available on Android devices.'
            );
            return;
        }

        try {
            const sendIntent = (Linking as unknown as { sendIntent?: (action: string) => Promise<void> }).sendIntent;
            if (typeof sendIntent === 'function') {
                await sendIntent('android.settings.VPN_SETTINGS');
                return;
            }

            const canOpen = await Linking.canOpenURL('android.settings.VPN_SETTINGS');
            if (canOpen) {
                await Linking.openURL('android.settings.VPN_SETTINGS');
                return;
            }

            await Linking.openSettings();
        } catch (error) {
            console.warn('Failed to open VPN settings', error);
            Alert.alert(
                'Unable to open settings',
                'Please open VPN settings manually to configure Always-on VPN.'
            );
        }
    };

    const handleClearData = () => {
        Alert.alert(
            'Clear All Data',
            'This will delete all profiles and settings. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert('Success', 'All data cleared');
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <Text style={styles.title}>Settings</Text>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Connection</Text>

                    <View style={styles.settingItem}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Auto-connect on startup</Text>
                            <Text style={styles.settingDescription}>
                                Automatically connect to last used profile
                            </Text>
                        </View>
                        <Switch
                            value={autoConnect}
                            onValueChange={setAutoConnect}
                            trackColor={{ false: '#ddd', true: '#4CAF50' }}
                        />
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Notifications</Text>
                            <Text style={styles.settingDescription}>
                                Show connection status notifications
                            </Text>
                        </View>
                        <Switch
                            value={notifications}
                            onValueChange={setNotifications}
                            trackColor={{ false: '#ddd', true: '#4CAF50' }}
                        />
                    </View>

                    <TouchableOpacity style={styles.settingItem} onPress={handleOpenVPNSettings}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Configure Always-on VPN</Text>
                            <Text style={styles.settingDescription}>
                                Open system VPN settings to enable Always-on VPN
                            </Text>
                        </View>
                        <Ionicons name="open-outline" size={22} color="#007AFF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Appearance</Text>

                    <View style={styles.settingItem}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Dark Mode</Text>
                            <Text style={styles.settingDescription}>
                                Use dark theme (Coming soon)
                            </Text>
                        </View>
                        <Switch
                            value={darkMode}
                            onValueChange={setDarkMode}
                            disabled
                            trackColor={{ false: '#ddd', true: '#4CAF50' }}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Data</Text>

                    <TouchableOpacity style={styles.dangerButton} onPress={handleClearData}>
                        <Text style={styles.dangerButtonText}>Clear All Data</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About</Text>

                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Version</Text>
                        <Text style={styles.infoValue}>1.0.0</Text>
                    </View>

                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Build</Text>
                        <Text style={styles.infoValue}>1</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    content: {
        flex: 1,
    },
    section: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#999',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    settingInfo: {
        flex: 1,
        marginRight: 16,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 14,
        color: '#666',
    },
    dangerButton: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#FF3B30',
        alignItems: 'center',
    },
    dangerButtonText: {
        color: '#FF3B30',
        fontSize: 16,
        fontWeight: '600',
    },
    infoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 16,
        color: '#666',
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
});
