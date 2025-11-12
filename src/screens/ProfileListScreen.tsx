import React, { useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    RefreshControl,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVPNStore } from '../store';
import { ProxyProfile } from '../types';

interface ProfileListScreenProps {
    navigation: any;
}

export const ProfileListScreen: React.FC<ProfileListScreenProps> = ({ navigation }) => {
    const {
        profiles,
        activeProfileId,
        isLoading,
        loadProfiles,
        deleteProfile,
        selectProfile,
    } = useVPNStore();

    useEffect(() => {
        loadProfiles();
    }, []);

    const handleRefresh = () => {
        loadProfiles();
    };

    const handleAddProfile = () => {
        navigation.navigate('ProfileForm');
    };

    const handleEditProfile = (profile: ProxyProfile) => {
        navigation.navigate('ProfileForm', { profile });
    };

    const handleDeleteProfile = (profile: ProxyProfile) => {
        Alert.alert(
            'Delete Profile',
            `Are you sure you want to delete "${profile.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteProfile(profile.id);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete profile');
                        }
                    },
                },
            ]
        );
    };

    const handleSelectProfile = async (profile: ProxyProfile) => {
        try {
            await selectProfile(profile.id);
            // Navigate to Home tab instead of Connection screen
            navigation.navigate('Home');
        } catch (error) {
            Alert.alert('Error', 'Failed to select profile');
        }
    };

    const renderProfile = ({ item }: { item: ProxyProfile }) => {
        const isActive = item.id === activeProfileId;

        return (
            <TouchableOpacity
                style={[styles.profileItem, isActive && styles.activeProfileItem]}
                onPress={() => handleSelectProfile(item)}
            >
                <View style={styles.profileInfo}>
                    <View style={styles.profileHeader}>
                        <Text style={styles.profileName}>{item.name}</Text>
                        {isActive && (
                            <View style={styles.activeIndicator}>
                                <Text style={styles.activeText}>ACTIVE</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.profileDetails}>
                        {item.type.toUpperCase()} • {item.host}:{item.port}
                    </Text>
                    {item.username && (
                        <Text style={styles.profileAuth}>🔐 Authenticated</Text>
                    )}
                </View>

                <View style={styles.profileActions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleEditProfile(item)}
                    >
                        <Text style={styles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeleteProfile(item)}
                    >
                        <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                            Delete
                        </Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <Text style={styles.title}>VPN Profiles</Text>
                <TouchableOpacity style={styles.addButton} onPress={handleAddProfile}>
                    <Text style={styles.addButtonText}>+ Add Profile</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={profiles}
                renderItem={renderProfile}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No profiles yet</Text>
                        <Text style={styles.emptySubtext}>
                            Tap "Add Profile" to create your first VPN profile
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
    addButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    addButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
    },
    profileItem: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    activeProfileItem: {
        borderWidth: 2,
        borderColor: '#4CAF50',
    },
    profileInfo: {
        marginBottom: 12,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    profileName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        flex: 1,
    },
    activeIndicator: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    activeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    profileDetails: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    profileAuth: {
        fontSize: 12,
        color: '#4CAF50',
    },
    profileActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        backgroundColor: '#007AFF',
        paddingVertical: 8,
        borderRadius: 6,
        alignItems: 'center',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    deleteButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#FF3B30',
    },
    deleteButtonText: {
        color: '#FF3B30',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#999',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
});
