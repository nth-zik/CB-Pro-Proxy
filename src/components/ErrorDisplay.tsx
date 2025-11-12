import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { VPNError, getTroubleshootingHints, formatError } from '../types/errors';

interface ErrorDisplayProps {
    error: VPNError;
    onRetry?: () => void;
    onDismiss?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
    error,
    onRetry,
    onDismiss,
}) => {
    const hints = getTroubleshootingHints(error);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.icon}>⚠️</Text>
                <Text style={styles.title}>Lỗi</Text>
            </View>

            <Text style={styles.message}>{formatError(error)}</Text>

            {hints.length > 0 && (
                <View style={styles.hintsContainer}>
                    <Text style={styles.hintsTitle}>Gợi ý khắc phục:</Text>
                    {hints.map((hint, index) => (
                        <Text key={index} style={styles.hint}>
                            • {hint}
                        </Text>
                    ))}
                </View>
            )}

            <View style={styles.actions}>
                {onDismiss && (
                    <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
                        <Text style={styles.dismissButtonText}>Đóng</Text>
                    </TouchableOpacity>
                )}
                {onRetry && error.recoverable && (
                    <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                        <Text style={styles.retryButtonText}>Thử lại</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFEBEE',
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#F44336',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    icon: {
        fontSize: 20,
        marginRight: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#C62828',
    },
    message: {
        fontSize: 14,
        color: '#C62828',
        marginBottom: 12,
        lineHeight: 20,
    },
    hintsContainer: {
        backgroundColor: '#FFF3E0',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    hintsTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#E65100',
        marginBottom: 8,
    },
    hint: {
        fontSize: 12,
        color: '#E65100',
        marginBottom: 4,
        lineHeight: 18,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    dismissButton: {
        flex: 1,
        backgroundColor: '#fff',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#F44336',
        alignItems: 'center',
    },
    dismissButtonText: {
        color: '#F44336',
        fontSize: 14,
        fontWeight: '600',
    },
    retryButton: {
        flex: 1,
        backgroundColor: '#F44336',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignItems: 'center',
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});
