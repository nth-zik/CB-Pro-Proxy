import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useVPNStore } from '../store';
import { ProxyProfile, ProxyType, validateProxyProfile, sanitizeProfileInput } from '../types';

interface ProfileFormScreenProps {
    navigation: any;
    route: any;
}

export const ProfileFormScreen: React.FC<ProfileFormScreenProps> = ({
    navigation,
    route,
}) => {
    const existingProfile = route.params?.profile as ProxyProfile | undefined;
    const isEditing = !!existingProfile;

    const { addProfile, updateProfile } = useVPNStore();

    const [name, setName] = useState(existingProfile?.name || '');
    const [host, setHost] = useState(existingProfile?.host || '');
    const [port, setPort] = useState(existingProfile?.port?.toString() || '');
    const [type, setType] = useState<ProxyType>(existingProfile?.type || 'socks5');
    const [username, setUsername] = useState(existingProfile?.username || '');
    const [password, setPassword] = useState(existingProfile?.password || '');
    const [dns1, setDns1] = useState(existingProfile?.dns1 || '1.1.1.1');
    const [dns2, setDns2] = useState(existingProfile?.dns2 || '8.8.8.8');
    const [showPassword, setShowPassword] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [quickImport, setQuickImport] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const parseProxyString = (proxyString: string) => {
        // Format: host:port:username:password
        const parts = proxyString.trim().split(':');

        if (parts.length < 2) {
            Alert.alert('Invalid Format', 'Proxy string must be in format: host:port:username:password');
            return;
        }

        const [parsedHost, parsedPort, parsedUsername, parsedPassword] = parts;

        setHost(parsedHost);
        setPort(parsedPort);

        if (parsedUsername) {
            setUsername(parsedUsername);
        }

        if (parsedPassword) {
            setPassword(parsedPassword);
        }

        // Auto-generate name if empty
        if (!name) {
            setName(`Proxy ${parsedHost}`);
        }

        setQuickImport('');
        Alert.alert('Success', 'Proxy details imported successfully!');
    };

    const handleQuickImport = () => {
        if (!quickImport.trim()) {
            Alert.alert('Error', 'Please enter a proxy string');
            return;
        }
        parseProxyString(quickImport);
    };

    const handleScanQR = async () => {
        if (!permission) {
            return;
        }

        if (!permission.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Permission Required', 'Camera permission is required to scan QR codes');
                return;
            }
        }

        setShowScanner(true);
    };

    const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
        setShowScanner(false);
        parseProxyString(data);
    };

    const handleSave = async () => {
        // Sanitize input
        const sanitized = sanitizeProfileInput({
            name,
            host,
            port: parseInt(port, 10),
            type,
            username,
            password,
            dns1,
            dns2,
        });

        // Validate
        const validation = validateProxyProfile(sanitized);
        if (!validation.valid) {
            Alert.alert('Validation Error', validation.errors.join('\n'));
            return;
        }

        setIsSaving(true);

        try {
            const profile: ProxyProfile = {
                id: existingProfile?.id || `profile_${Date.now()}`,
                name: sanitized.name!,
                host: sanitized.host!,
                port: sanitized.port!,
                type: sanitized.type!,
                username: sanitized.username,
                password: sanitized.password,
                dns1: sanitized.dns1,
                dns2: sanitized.dns2,
                createdAt: existingProfile?.createdAt || new Date(),
                updatedAt: new Date(),
            };

            if (isEditing) {
                await updateProfile(profile);
                Alert.alert('Success', 'Profile updated successfully');
            } else {
                await addProfile(profile);
                Alert.alert('Success', 'Profile created successfully');
            }

            navigation.goBack();
        } catch (error) {
            Alert.alert('Error', 'Failed to save profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        navigation.goBack();
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView style={styles.container}>
                <View style={styles.form}>
                    <Text style={styles.sectionTitle}>Quick Import</Text>
                    <Text style={styles.helpText}>
                        Paste proxy string in format: host:port:username:password
                    </Text>
                    <View style={styles.quickImportContainer}>
                        <TextInput
                            style={[styles.input, styles.quickImportInput]}
                            value={quickImport}
                            onChangeText={setQuickImport}
                            placeholder="host:port:username:password"
                            placeholderTextColor="#999"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <TouchableOpacity
                            style={styles.importButton}
                            onPress={handleQuickImport}
                        >
                            <Text style={styles.importButtonText}>Import</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.scanButton}
                        onPress={handleScanQR}
                    >
                        <Text style={styles.scanButtonText}>📷 Scan QR Code</Text>
                    </TouchableOpacity>

                    <Text style={styles.sectionTitle}>Profile Information</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Profile Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="My VPN Profile"
                            placeholderTextColor="#999"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Proxy Host *</Text>
                        <TextInput
                            style={styles.input}
                            value={host}
                            onChangeText={setHost}
                            placeholder="proxy.example.com or 192.168.1.1"
                            placeholderTextColor="#999"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Proxy Port * (1-65535)</Text>
                        <TextInput
                            style={styles.input}
                            value={port}
                            onChangeText={setPort}
                            placeholder="1080"
                            placeholderTextColor="#999"
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Proxy Type *</Text>
                        <View style={styles.typeSelector}>
                            <TouchableOpacity
                                style={[
                                    styles.typeButton,
                                    type === 'socks5' && styles.typeButtonActive,
                                ]}
                                onPress={() => setType('socks5')}
                            >
                                <Text
                                    style={[
                                        styles.typeButtonText,
                                        type === 'socks5' && styles.typeButtonTextActive,
                                    ]}
                                >
                                    SOCKS5
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.typeButton,
                                    type === 'http' && styles.typeButtonActive,
                                ]}
                                onPress={() => setType('http')}
                            >
                                <Text
                                    style={[
                                        styles.typeButtonText,
                                        type === 'http' && styles.typeButtonTextActive,
                                    ]}
                                >
                                    HTTP
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>Authentication (Optional)</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Username</Text>
                        <TextInput
                            style={styles.input}
                            value={username}
                            onChangeText={setUsername}
                            placeholder="username"
                            placeholderTextColor="#999"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={[styles.input, styles.passwordInput]}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="password"
                                placeholderTextColor="#999"
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <TouchableOpacity
                                style={styles.showPasswordButton}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Text style={styles.showPasswordText}>
                                    {showPassword ? 'Hide' : 'Show'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>DNS Settings</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Primary DNS</Text>
                        <TextInput
                            style={styles.input}
                            value={dns1}
                            onChangeText={setDns1}
                            placeholder="1.1.1.1"
                            placeholderTextColor="#999"
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="numbers-and-punctuation"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Secondary DNS</Text>
                        <TextInput
                            style={styles.input}
                            value={dns2}
                            onChangeText={setDns2}
                            placeholder="8.8.8.8"
                            placeholderTextColor="#999"
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="numbers-and-punctuation"
                        />
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={handleCancel}
                            disabled={isSaving}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.saveButton]}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            <Text style={styles.saveButtonText}>
                                {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            <Modal
                visible={showScanner}
                animationType="slide"
                onRequestClose={() => setShowScanner(false)}
            >
                <SafeAreaView style={styles.scannerContainer}>
                    <View style={styles.scannerHeader}>
                        <Text style={styles.scannerTitle}>Scan QR Code</Text>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setShowScanner(false)}
                        >
                            <Text style={styles.closeButtonText}>✕ Close</Text>
                        </TouchableOpacity>
                    </View>
                    <CameraView
                        style={styles.camera}
                        facing="back"
                        onBarcodeScanned={handleBarCodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ['qr'],
                        }}
                    />
                    <View style={styles.scannerOverlay}>
                        <Text style={styles.scannerInstructions}>
                            Point camera at QR code containing proxy details
                        </Text>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    container: {
        flex: 1,
    },
    form: {
        padding: 16,
    },
    helpText: {
        fontSize: 12,
        color: '#999',
        marginBottom: 8,
        fontStyle: 'italic',
    },
    quickImportContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    quickImportInput: {
        flex: 1,
    },
    importButton: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        justifyContent: 'center',
    },
    importButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    scanButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 8,
    },
    scanButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    scannerContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    scannerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#000',
    },
    scannerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    closeButton: {
        padding: 8,
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    camera: {
        flex: 1,
    },
    scannerOverlay: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
        padding: 20,
    },
    scannerInstructions: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 16,
        borderRadius: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginTop: 16,
        marginBottom: 12,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#333',
    },
    typeSelector: {
        flexDirection: 'row',
        gap: 12,
    },
    typeButton: {
        flex: 1,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    typeButtonActive: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    typeButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    typeButtonTextActive: {
        color: '#fff',
    },
    passwordContainer: {
        position: 'relative',
    },
    passwordInput: {
        paddingRight: 70,
    },
    showPasswordButton: {
        position: 'absolute',
        right: 12,
        top: 12,
        padding: 4,
    },
    showPasswordText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    button: {
        flex: 1,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#007AFF',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
