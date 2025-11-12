import { VPNError, VPNErrorCode, createVPNError } from '../types/errors';

/**
 * ErrorHandler - Centralized error handling service
 */
export class ErrorHandler {
    private static errorListeners: Array<(error: VPNError) => void> = [];

    /**
     * Handle error and notify listeners
     */
    static handleError(error: VPNError): void {
        // Log error
        console.error('[VPN Error]', error);

        // Notify listeners
        this.errorListeners.forEach(listener => {
            try {
                listener(error);
            } catch (e) {
                console.error('Error in error listener:', e);
            }
        });
    }

    /**
     * Add error listener
     */
    static addErrorListener(listener: (error: VPNError) => void): () => void {
        this.errorListeners.push(listener);

        // Return unsubscribe function
        return () => {
            const index = this.errorListeners.indexOf(listener);
            if (index > -1) {
                this.errorListeners.splice(index, 1);
            }
        };
    }

    /**
     * Parse native error to VPNError
     */
    static parseNativeError(error: any): VPNError {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';

        // Try to match error message to error code
        if (errorMessage.includes('permission')) {
            return createVPNError(VPNErrorCode.PERMISSION_DENIED, errorMessage);
        }

        if (errorMessage.includes('auth') || errorMessage.includes('credential')) {
            return createVPNError(VPNErrorCode.AUTH_FAILED, errorMessage);
        }

        if (errorMessage.includes('timeout')) {
            return createVPNError(VPNErrorCode.CONNECTION_TIMEOUT, errorMessage);
        }

        if (errorMessage.includes('unreachable') || errorMessage.includes('connect')) {
            return createVPNError(VPNErrorCode.CONNECTION_FAILED, errorMessage);
        }

        if (errorMessage.includes('profile')) {
            return createVPNError(VPNErrorCode.PROFILE_NOT_FOUND, errorMessage);
        }

        // Default to unknown error
        return createVPNError(VPNErrorCode.UNKNOWN_ERROR, errorMessage);
    }

    /**
     * Handle storage error
     */
    static handleStorageError(error: any): VPNError {
        const vpnError = createVPNError(
            VPNErrorCode.STORAGE_ERROR,
            error?.message || 'Storage operation failed'
        );
        this.handleError(vpnError);
        return vpnError;
    }

    /**
     * Handle connection error
     */
    static handleConnectionError(error: any): VPNError {
        const vpnError = createVPNError(
            VPNErrorCode.CONNECTION_FAILED,
            error?.message || 'Connection failed'
        );
        this.handleError(vpnError);
        return vpnError;
    }

    /**
     * Handle authentication error
     */
    static handleAuthError(error: any): VPNError {
        const vpnError = createVPNError(
            VPNErrorCode.AUTH_FAILED,
            error?.message || 'Authentication failed',
            true
        );
        this.handleError(vpnError);
        return vpnError;
    }
}
