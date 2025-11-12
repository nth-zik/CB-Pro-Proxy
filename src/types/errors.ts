/**
 * Error types for CBV VPN App
 */

export enum VPNErrorCode {
    // Connection errors
    CONNECTION_FAILED = 'CONNECTION_FAILED',
    CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
    CONNECTION_LOST = 'CONNECTION_LOST',

    // Authentication errors
    AUTH_FAILED = 'AUTH_FAILED',
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

    // Permission errors
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    VPN_PERMISSION_REQUIRED = 'VPN_PERMISSION_REQUIRED',

    // Configuration errors
    INVALID_CONFIG = 'INVALID_CONFIG',
    INVALID_PROFILE = 'INVALID_PROFILE',
    PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',

    // Network errors
    NETWORK_UNREACHABLE = 'NETWORK_UNREACHABLE',
    DNS_RESOLUTION_FAILED = 'DNS_RESOLUTION_FAILED',
    PROXY_UNREACHABLE = 'PROXY_UNREACHABLE',

    // Service errors
    SERVICE_START_FAILED = 'SERVICE_START_FAILED',
    SERVICE_STOP_FAILED = 'SERVICE_STOP_FAILED',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

    // Storage errors
    STORAGE_ERROR = 'STORAGE_ERROR',
    ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',

    // Unknown errors
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface VPNError {
    code: VPNErrorCode;
    message: string;
    details?: string;
    timestamp: Date;
    recoverable: boolean;
}

/**
 * Error messages in Vietnamese
 */
export const ERROR_PREFIX = '[CB Pro Proxy]';
export const ErrorMessages: Record<VPNErrorCode, string> = {
    [VPNErrorCode.CONNECTION_FAILED]: 'Không thể kết nối VPN',
    [VPNErrorCode.CONNECTION_TIMEOUT]: 'Kết nối VPN timeout',
    [VPNErrorCode.CONNECTION_LOST]: 'Mất kết nối VPN',

    [VPNErrorCode.AUTH_FAILED]: 'Xác thực thất bại',
    [VPNErrorCode.INVALID_CREDENTIALS]: 'Thông tin đăng nhập không hợp lệ',

    [VPNErrorCode.PERMISSION_DENIED]: 'Không có quyền truy cập',
    [VPNErrorCode.VPN_PERMISSION_REQUIRED]: 'Cần cấp quyền VPN',

    [VPNErrorCode.INVALID_CONFIG]: 'Cấu hình không hợp lệ',
    [VPNErrorCode.INVALID_PROFILE]: 'Profile không hợp lệ',
    [VPNErrorCode.PROFILE_NOT_FOUND]: 'Không tìm thấy profile',

    [VPNErrorCode.NETWORK_UNREACHABLE]: 'Không thể kết nối mạng',
    [VPNErrorCode.DNS_RESOLUTION_FAILED]: 'Không thể phân giải DNS',
    [VPNErrorCode.PROXY_UNREACHABLE]: 'Không thể kết nối proxy',

    [VPNErrorCode.SERVICE_START_FAILED]: 'Không thể khởi động VPN service',
    [VPNErrorCode.SERVICE_STOP_FAILED]: 'Không thể dừng VPN service',
    [VPNErrorCode.SERVICE_UNAVAILABLE]: 'VPN service không khả dụng',

    [VPNErrorCode.STORAGE_ERROR]: 'Lỗi lưu trữ dữ liệu',
    [VPNErrorCode.ENCRYPTION_ERROR]: 'Lỗi mã hóa dữ liệu',

    [VPNErrorCode.UNKNOWN_ERROR]: 'Lỗi không xác định',
};

/**
 * Troubleshooting hints for each error
 */
export const TroubleshootingHints: Partial<Record<VPNErrorCode, string[]>> = {
    [VPNErrorCode.CONNECTION_FAILED]: [
        'Kiểm tra thông tin proxy (host, port)',
        'Đảm bảo proxy server đang hoạt động',
        'Kiểm tra kết nối internet',
    ],

    [VPNErrorCode.AUTH_FAILED]: [
        'Kiểm tra username và password',
        'Đảm bảo proxy yêu cầu authentication',
        'Thử tạo lại profile với thông tin mới',
    ],

    [VPNErrorCode.PERMISSION_DENIED]: [
        'Cấp quyền VPN trong Settings',
        'Khởi động lại app',
    ],

    [VPNErrorCode.PROXY_UNREACHABLE]: [
        'Kiểm tra proxy host và port',
        'Đảm bảo proxy server đang chạy',
        'Kiểm tra firewall settings',
    ],

    [VPNErrorCode.NETWORK_UNREACHABLE]: [
        'Kiểm tra kết nối WiFi/Mobile data',
        'Thử kết nối lại mạng',
        'Kiểm tra airplane mode',
    ],
};

/**
 * Create VPN error
 */
export function createVPNError(
    code: VPNErrorCode,
    details?: string,
    recoverable: boolean = true
): VPNError {
    return {
        code,
        message: ErrorMessages[code],
        details,
        timestamp: new Date(),
        recoverable,
    };
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: VPNError): boolean {
    return error.recoverable;
}

/**
 * Get troubleshooting hints for error
 */
export function getTroubleshootingHints(error: VPNError): string[] {
    return TroubleshootingHints[error.code] || [];
}

/**
 * Format error for display
 */
export function formatError(error: VPNError): string {
    let message = error.message;
    if (error.details) {
        message += `\n\n${error.details}`;
    }
    return message;
}
