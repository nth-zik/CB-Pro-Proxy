import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
} from 'react-native';
import { useVPNStore } from '../store';

const { width } = Dimensions.get('window');

interface ProfileNotificationProps {
    onPress?: (profileId: string) => void;
}

export const ProfileNotification: React.FC<ProfileNotificationProps> = ({ onPress }) => {
    const { profileNotification, clearProfileNotification } = useVPNStore();
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const handleDismissInternal = () => {
        Animated.timing(slideAnim, {
            toValue: -100,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            clearProfileNotification();
        });
    };

    useEffect(() => {
        if (profileNotification) {
            // Clear any existing timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Slide in
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
            }).start();

            // Auto dismiss after 5 seconds
            timeoutRef.current = setTimeout(() => {
                handleDismissInternal();
            }, 5000);
        } else {
            // Slide out
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [profileNotification]);

    const handleDismiss = () => {
        handleDismissInternal();
    };

    const handlePress = () => {
        if (profileNotification && onPress) {
            onPress(profileNotification.id);
            handleDismissInternal();
        }
    };

    if (!profileNotification) {
        return null;
    }

    const { name, host, port, type, isUpdate } = profileNotification;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            <TouchableOpacity
                style={styles.notification}
                onPress={handlePress}
                activeOpacity={0.9}
            >
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>{isUpdate ? '✏️' : '➕'}</Text>
                </View>
                <View style={styles.content}>
                    <Text style={styles.title}>
                        {isUpdate ? 'Profile Updated' : 'New Profile Added'}
                    </Text>
                    <Text style={styles.profileName} numberOfLines={1}>
                        {name}
                    </Text>
                    {host && port && (
                        <Text style={styles.details} numberOfLines={1}>
                            {type?.toUpperCase()} • {host}:{port}
                        </Text>
                    )}
                    <Text style={styles.hint}>Tap to view details</Text>
                </View>
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={handleDismiss}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        paddingHorizontal: 16,
        paddingTop: 50, // Below status bar
    },
    notification: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#4CAF50',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E8F5E9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    icon: {
        fontSize: 20,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
        color: '#333',
        marginBottom: 4,
    },
    profileName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#007AFF',
        marginBottom: 2,
    },
    details: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    hint: {
        fontSize: 11,
        color: '#999',
        fontStyle: 'italic',
    },
    closeButton: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeText: {
        fontSize: 18,
        color: '#999',
        fontWeight: '600',
    },
});
