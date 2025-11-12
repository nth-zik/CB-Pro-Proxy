import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LogEntry {
    id: string;
    timestamp: Date;
    level: 'info' | 'warning' | 'error';
    message: string;
}

export const LogsScreen: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([
        {
            id: '1',
            timestamp: new Date(),
            level: 'info',
            message: 'App started',
        },
    ]);

    const clearLogs = () => {
        setLogs([]);
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'error':
                return '#F44336';
            case 'warning':
                return '#FFC107';
            default:
                return '#4CAF50';
        }
    };

    const getLevelIcon = (level: string) => {
        switch (level) {
            case 'error':
                return '❌';
            case 'warning':
                return '⚠️';
            default:
                return 'ℹ️';
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
            <View style={styles.header}>
                <Text style={styles.title}>Connection Logs</Text>
                <TouchableOpacity style={styles.clearButton} onPress={clearLogs}>
                    <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.logContainer}>
                {logs.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No logs yet</Text>
                    </View>
                ) : (
                    logs.map((log) => (
                        <View key={log.id} style={styles.logEntry}>
                            <View style={styles.logHeader}>
                                <Text style={styles.logIcon}>{getLevelIcon(log.level)}</Text>
                                <Text
                                    style={[
                                        styles.logLevel,
                                        { color: getLevelColor(log.level) },
                                    ]}
                                >
                                    {log.level.toUpperCase()}
                                </Text>
                                <Text style={styles.logTime}>
                                    {log.timestamp.toLocaleTimeString()}
                                </Text>
                            </View>
                            <Text style={styles.logMessage}>{log.message}</Text>
                        </View>
                    ))
                )}
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
    clearButton: {
        backgroundColor: '#FF3B30',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    clearButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    logContainer: {
        flex: 1,
        padding: 16,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
    },
    logEntry: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#4CAF50',
    },
    logHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    logIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    logLevel: {
        fontSize: 12,
        fontWeight: 'bold',
        marginRight: 8,
    },
    logTime: {
        fontSize: 12,
        color: '#999',
    },
    logMessage: {
        fontSize: 14,
        color: '#333',
        marginLeft: 24,
    },
});
