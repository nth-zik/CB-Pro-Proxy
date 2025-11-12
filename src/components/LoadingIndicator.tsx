import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

interface LoadingIndicatorProps {
    message?: string;
    size?: 'small' | 'large';
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
    message,
    size = 'large',
}) => {
    return (
        <View style={styles.container}>
            <ActivityIndicator size={size} color="#007AFF" />
            {message && <Text style={styles.message}>{message}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    message: {
        marginTop: 12,
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
});
