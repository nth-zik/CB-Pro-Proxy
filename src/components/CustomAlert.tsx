import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
} from 'react-native';

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message: string;
    buttons?: Array<{
        text: string;
        onPress?: () => void;
        style?: 'default' | 'cancel' | 'destructive';
    }>;
    onClose?: () => void;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
    visible,
    title,
    message,
    buttons = [{ text: 'OK' }],
    onClose,
}) => {
    const handleButtonPress = (button: typeof buttons[0]) => {
        if (button.onPress) {
            button.onPress();
        }
        if (onClose) {
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.alertContainer}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    <View style={styles.buttonContainer}>
                        {buttons.map((button, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.button,
                                    button.style === 'cancel' && styles.cancelButton,
                                    button.style === 'destructive' && styles.destructiveButton,
                                ]}
                                onPress={() => handleButtonPress(button)}
                            >
                                <Text
                                    style={[
                                        styles.buttonText,
                                        button.style === 'cancel' && styles.cancelButtonText,
                                        button.style === 'destructive' && styles.destructiveButtonText,
                                    ]}
                                >
                                    {button.text}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    alertContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#666',
        marginBottom: 24,
        textAlign: 'center',
        lineHeight: 22,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#f0f0f0',
    },
    destructiveButton: {
        backgroundColor: '#F44336',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButtonText: {
        color: '#007AFF',
    },
    destructiveButtonText: {
        color: '#fff',
    },
});
