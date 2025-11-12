import * as SecureStore from 'expo-secure-store';

/**
 * CryptoService cung cấp các phương thức mã hóa/giải mã dữ liệu nhạy cảm
 * Sử dụng expo-secure-store làm backend, đã tích hợp encryption native
 */
export class CryptoService {
    /**
     * Mã hóa và lưu trữ dữ liệu nhạy cảm
     * expo-secure-store tự động mã hóa dữ liệu:
     * - iOS: Sử dụng Keychain
     * - Android: Sử dụng EncryptedSharedPreferences với AES-256
     */
    async encryptAndStore(key: string, data: string): Promise<void> {
        try {
            await SecureStore.setItemAsync(key, data, {
                keychainAccessible: SecureStore.WHEN_UNLOCKED,
            });
        } catch (error) {
            console.error('Error encrypting and storing data:', error);
            throw new Error('Failed to encrypt and store data');
        }
    }

    /**
     * Lấy và giải mã dữ liệu đã lưu trữ
     */
    async retrieveAndDecrypt(key: string): Promise<string | null> {
        try {
            const data = await SecureStore.getItemAsync(key);
            return data;
        } catch (error) {
            console.error('Error retrieving and decrypting data:', error);
            return null;
        }
    }

    /**
     * Xóa dữ liệu đã mã hóa
     */
    async deleteEncrypted(key: string): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(key);
        } catch (error) {
            console.warn('Error deleting encrypted data:', error);
        }
    }

    /**
     * Kiểm tra xem một key có tồn tại không
     */
    async hasKey(key: string): Promise<boolean> {
        try {
            const data = await SecureStore.getItemAsync(key);
            return data !== null;
        } catch (error) {
            return false;
        }
    }
}

// Export singleton instance
export const cryptoService = new CryptoService();
