import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    PermissionsAndroid,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVPNStore } from '../store';
import { VPNModule } from '../native';
import { CustomAlert } from '../components/CustomAlert';

interface ConnectionScreenProps {
    navigation: any;
}

export const ConnectionScreen: React.FC<ConnectionScreenProps> = ({ navigation }) => {
    const {
        profiles,
        activeProfileId,
        vpnStatus,
        error,
        connectionStats,
        publicIp,
        loadProfiles,
        setVPNStatus,
        setError,
    } = useVPNStore();

    const [alertConfig, setAlertConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        buttons: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>;
    }>({
        visible: false,
        title: '',
        message: '',
        buttons: [],
    });

    const [isConnectingLocal, setIsConnectingLocal] = useState(false);

    useEffect(() => {
        const requestNotificationPermission = async () => {
            if (Platform.OS === 'android' && Platform.Version >= 33) {
                try {
                    const granted = await PermissionsAndroid.request(
                        'android.permission.POST_NOTIFICATIONS' as any
                    );
                    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                        console.warn('POST_NOTIFICATIONS permission was not granted.');
                    }
                } catch (err) {
                    console.warn('POST_NOTIFICATIONS permission error:', err);
                }
            }
        };

        requestNotificationPermission();
        loadProfiles();

        console.log('🔍 Testing VPNModule...');
        VPNModule.getStatus()
            .then(status => {
                console.log('✅ VPNModule is working! Status:', status);
            })
            .catch(error => {
                console.error('❌ VPNModule error:', error);
            });

        // Request native module to broadcast latest status in case VPN already running
        VPNModule.refreshStatus();

        return () => {
            // statusSubscription?.remove();
            // errorSubscription?.remove();
            // notificationTimeoutRef.current && clearTimeout(notificationTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!isConnectingLocal) {
            return;
        }

        if (vpnStatus === 'connected' || vpnStatus === 'error' || vpnStatus === 'disconnected') {
            setIsConnectingLocal(false);
        }
    }, [vpnStatus, isConnectingLocal]);

    const showAlert = (title: string, message: string, buttons: typeof alertConfig.buttons) => {
        setAlertConfig({ visible: true, title, message, buttons });
    };

    const hideAlert = () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
    };

    const activeProfile = profiles.find(p => p.id === activeProfileId);

    const connectionState = useMemo(() => {
        const status = vpnStatus;
        if (status === 'connected') return 'connected';
        if (status === 'handshaking') return 'handshaking';
        if (status === 'connecting' || isConnectingLocal) return 'connecting';
        if (status === 'error') return 'error';
        return 'disconnected';
    }, [vpnStatus, isConnectingLocal]);

    const isConnecting = connectionState === 'connecting' || connectionState === 'handshaking';
    const isConnected = connectionState === 'connected';
    const canConnect = (connectionState === 'disconnected' || connectionState === 'error') && !!activeProfile;
    const canDisconnect = isConnected || isConnecting;

    const connectButtonLabel = useMemo(() => {
        switch (connectionState) {
            case 'connected':
                return 'Connected';
            case 'handshaking':
                return 'Handshaking';
            case 'connecting':
                return 'Connecting';
            case 'error':
                return 'Connection Failed';
            default:
                return 'Connect';
        }
    }, [connectionState]);

    const connectButtonSubtitle = useMemo(() => {
        const ipAddress = publicIp || connectionStats.publicIp;
        switch (connectionState) {
            case 'connected':
                return ipAddress ? `IP: ${ipAddress}` : 'Tunnel is active';
            case 'handshaking':
                return 'Negotiating secure tunnel';
            case 'connecting':
                return 'Requesting VPN permission';
            case 'error':
                return error ? 'Tap to retry' : 'Tap to reconnect';
            case 'disconnected':
            default:
                return activeProfile ? 'Tap to start VPN' : 'Select a profile first';
        }
    }, [connectionState, publicIp, connectionStats.publicIp, error, activeProfile]);

    const connectButtonTheme = useMemo(() => {
        switch (connectionState) {
            case 'connected':
                return {
                    backgroundColor: '#0C8A5F',
                    borderColor: 'rgba(12, 138, 95, 0.4)',
                    textColor: '#FFFFFF',
                    subtitleColor: '#D0FFED',
                };
            case 'handshaking':
                return {
                    backgroundColor: '#C97700',
                    borderColor: 'rgba(201, 119, 0, 0.35)',
                    textColor: '#FFFFFF',
                    subtitleColor: '#FFE0B2',
                };
            case 'connecting':
                return {
                    backgroundColor: '#AF1F5C',
                    borderColor: 'rgba(175, 31, 92, 0.35)',
                    textColor: '#FFFFFF',
                    subtitleColor: '#FFD6E6',
                };
            case 'error':
                return {
                    backgroundColor: '#8E1621',
                    borderColor: 'rgba(142, 22, 33, 0.35)',
                    textColor: '#FFFFFF',
                    subtitleColor: '#FFB3BA',
                };
            default:
                return {
                    backgroundColor: '#1D4ED8',
                    borderColor: 'rgba(29, 78, 216, 0.35)',
                    textColor: '#FFFFFF',
                    subtitleColor: '#D6E4FF',
                };
        }
    }, [connectionState]);

    // Track instantaneous speeds (bytes/sec)
    const lastSampleRef = useRef<{ ts: number; up: number; down: number } | null>(null);
    const [speeds, setSpeeds] = useState<{ upBps: number; downBps: number }>({ upBps: 0, downBps: 0 });

    useEffect(() => {
        const now = Date.now();
        const { bytesUp, bytesDown } = connectionStats;
        const last = lastSampleRef.current;
        if (isConnected && last) {
            const dt = (now - last.ts) / 1000;
            if (dt > 0.1) {
                const upBps = Math.max(0, (bytesUp - last.up) / dt);
                const downBps = Math.max(0, (bytesDown - last.down) / dt);
                setSpeeds({ upBps, downBps });
            }
        } else if (!isConnected) {
            setSpeeds({ upBps: 0, downBps: 0 });
        }
        lastSampleRef.current = { ts: now, up: bytesUp, down: bytesDown };
    }, [connectionStats, isConnected]);

    const formatDuration = (durationMillis: number) => {
        if (durationMillis <= 0) return '00:00:00';
        const totalSeconds = Math.floor(durationMillis / 1000);
        const hours = Math.floor(totalSeconds / 3600)
            .toString()
            .padStart(2, '0');
        const minutes = Math.floor((totalSeconds % 3600) / 60)
            .toString()
            .padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    };

    const formatBytes = (bytes: number) => {
        if (bytes <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let value = bytes;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }
        return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    };

    const formatRate = (bps: number) => {
        // bytes per second -> human readable
        if (bps <= 0) return '0 B/s';
        const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        let value = bps;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }
        return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    };

    const handleConnect = async () => {
        if (!activeProfile) {
            showAlert(
                'No Profile Selected',
                'Please select a profile from the profile list first.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Select Profile', onPress: () => navigation.navigate('Profiles') },
                ]
            );
            return;
        }

        setIsConnectingLocal(true);

        try {
            // Android 13+ requires POST_NOTIFICATIONS at runtime for foreground services
            if (Platform.OS === 'android' && Platform.Version >= 33) {
                try {
                    const granted = await PermissionsAndroid.request(
                        // Literal string since RN may not have a typed constant yet
                        'android.permission.POST_NOTIFICATIONS' as any
                    );
                    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                        console.warn('POST_NOTIFICATIONS permission not granted');
                    }
                } catch (permErr) {
                    console.warn('Failed to request POST_NOTIFICATIONS permission', permErr);
                }
            }

            console.log('🔵 Starting VPN with profile:', activeProfile.id, activeProfile.name);

            // Use startVPNWithProfile to pass profile data directly
            await VPNModule.startVPNWithProfile(
                activeProfile.name,
                activeProfile.host,
                activeProfile.port,
                activeProfile.type,
                activeProfile.username || '',
                activeProfile.password || '',
                activeProfile.dns1,
                activeProfile.dns2
            );
            console.log('✅ VPN started successfully');

        } catch (error: any) {
            console.error('❌ VPN start error:', error);
            setError(error.message || 'Failed to start VPN');
            setVPNStatus('disconnected');
            setIsConnectingLocal(false);

            let errorMessage = error.message || 'Failed to start VPN. Please try again.';

            if (error.code === 'VPN_PERMISSION_DENIED') {
                errorMessage = 'VPN permission was denied. Please grant permission to use VPN.';
            } else if (error.code === 'NO_ACTIVITY') {
                errorMessage = 'Unable to request VPN permission. Please try again.';
            }

            showAlert(
                'Connection Error',
                errorMessage,
                [{ text: 'OK' }]
            );
        }
    };

    const handleDisconnect = async () => {
        try {
            setIsConnectingLocal(false);
            await VPNModule.stopVPN();
        } catch (error: any) {
            console.error('Error stopping VPN:', error);
        }
    };

    const handleSelectProfile = () => {
        navigation.navigate('Profiles');
    };

    const getStatusColor = () => {
        switch (vpnStatus) {
            case 'connected':
                return '#4CAF50';
            case 'connecting':
            case 'handshaking':
                return '#FFC107';
            case 'error':
                return '#F44336';
            default:
                return '#9E9E9E';
        }
    };

    const getStatusText = () => {
        switch (vpnStatus) {
            case 'connected':
                return 'Connected';
            case 'connecting':
                return 'Connecting...';
            case 'handshaking':
                return 'Handshaking...';
            case 'error':
                return 'Error';
            default:
                return 'Disconnected';
        }
    };

    const { durationMillis, bytesUp, bytesDown } = connectionStats;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.statusCard}>
                    <View style={styles.statusHeader}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                        <Text style={styles.statusText}>{getStatusText()}</Text>
                    </View>
                    <View style={styles.durationRow}>
                        <Text style={styles.durationLabel}>Duration</Text>
                        <Text style={styles.durationValue}>{formatDuration(durationMillis)}</Text>
                    </View>
                    <View style={styles.speedRow}>
                        <View style={styles.speedItem}>
                            <Text style={styles.speedLabel}>Download</Text>
                            <Text style={styles.speedValue}>{formatRate(speeds.downBps)}</Text>
                        </View>
                        <View style={styles.speedItem}>
                            <Text style={styles.speedLabel}>Upload</Text>
                            <Text style={styles.speedValue}>{formatRate(speeds.upBps)}</Text>
                        </View>
                    </View>
                </View>

                {activeProfile ? (
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileLabel}>Active Profile</Text>
                        <Text style={styles.profileName}>{activeProfile.name}</Text>
                        <Text style={styles.profileDetails}>
                            {activeProfile.type.toUpperCase()} • {activeProfile.host}:{activeProfile.port}
                        </Text>
                        {activeProfile.username && (
                            <Text style={styles.profileAuth}>🔐 Authenticated</Text>
                        )}
                        <TouchableOpacity
                            style={styles.changeProfileButton}
                            onPress={handleSelectProfile}
                        >
                            <Text style={styles.changeProfileText}>Change Profile</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.noProfileContainer}>
                        <Text style={styles.noProfileText}>No profile selected</Text>
                        <TouchableOpacity
                            style={styles.selectProfileButton}
                            onPress={handleSelectProfile}
                        >
                            <Text style={styles.selectProfileButtonText}>Select Profile</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.connectionControl}>
                    <TouchableOpacity
                        style={[
                            styles.connectButton,
                            {
                                backgroundColor: connectButtonTheme.backgroundColor,
                                borderColor: connectButtonTheme.borderColor,
                            },
                            (!canConnect && !canDisconnect) && styles.connectButtonDisabled,
                        ]}
                        onPress={isConnected || isConnecting ? handleDisconnect : handleConnect}
                        disabled={!canConnect && !canDisconnect}
                        activeOpacity={0.92}
                    >
                        <View style={styles.connectButtonTextWrap}>
                            <Text
                                style={[styles.connectButtonTitle, { color: connectButtonTheme.textColor }]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {isConnecting ? `${connectButtonLabel}…` : connectButtonLabel}
                            </Text>
                            <Text
                                style={[styles.connectButtonSubtitle, { color: connectButtonTheme.subtitleColor }]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {connectButtonSubtitle}
                            </Text>
                        </View>
                        {isConnecting && (
                            <ActivityIndicator color={connectButtonTheme.textColor} style={styles.connectButtonSpinner} />
                        )}
                    </TouchableOpacity>
                </View>

                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorTitle}>⚠️ Error</Text>
                        <Text style={styles.errorMessage}>{error}</Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={handleConnect}
                        >
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                
            </ScrollView>

            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                buttons={alertConfig.buttons}
                onClose={hideAlert}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContent: {
        padding: 16,
        flexGrow: 1,
    },
    statusCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginTop: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    durationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    durationLabel: {
        fontSize: 12,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    durationValue: {
        fontSize: 18,
        fontWeight: '600',
        color: '#222',
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    statusText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    speedRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    connectingContent: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    loadingSpinner: {
        marginRight: 8,
    },
    connectButtonDisabled: {
        backgroundColor: '#cccccc',
        opacity: 0.6,
    },
    connectButtonContent: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        gap: 12,
    },
    connectButtonTextWrapper: {
        alignItems: 'center',
        gap: 4,
    },
    connectButtonTitle: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 1,
    },
    connectButtonSubtitle: {
        color: '#f0f0f0',
        fontSize: 14,
        opacity: 0.8,
        textAlign: 'center',
    },
    cancelText: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    speedItem: {
        flex: 1,
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    speedLabel: {
        fontSize: 12,
        color: '#888',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    speedValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#222',
    },
    statsCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginTop: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statsItem: {
        flex: 1,
        alignItems: 'center',
    },
    statsLabel: {
        fontSize: 12,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 6,
    },
    statsValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#222',
    },
    statsHint: {
        marginTop: 16,
        fontSize: 12,
        color: '#888',
        textAlign: 'center',
    },
    profileInfo: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    profileLabel: {
        fontSize: 12,
        color: '#999',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    profileName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    profileDetails: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    profileAuth: {
        fontSize: 12,
        color: '#4CAF50',
        marginBottom: 12,
    },
    changeProfileButton: {
        alignSelf: 'flex-start',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        backgroundColor: '#f0f0f0',
    },
    changeProfileText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600',
    },
    noProfileContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 32,
        marginBottom: 24,
        alignItems: 'center',
    },
    noProfileText: {
        fontSize: 16,
        color: '#999',
        marginBottom: 16,
    },
    selectProfileButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    selectProfileButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    connectionControl: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
        marginBottom: 32,
    },
    connectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 999,
        borderWidth: 1,
        minWidth: 260,
        maxWidth: 320,
        alignSelf: 'center',
    },
    connectButtonDisabled: {
        opacity: 0.55,
    },
    connectButtonTextWrap: {
        flex: 1,
        marginRight: 8,
    },
    connectButtonTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    connectButtonSubtitle: {
        marginTop: 4,
        fontSize: 13,
        opacity: 0.75,
    },
    connectButtonSpinner: {
        marginLeft: 4,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    publicIpContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginVertical: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#007AFF',
    },
    publicIpLabel: {
        fontSize: 11,
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    publicIpValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#007AFF',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
});
