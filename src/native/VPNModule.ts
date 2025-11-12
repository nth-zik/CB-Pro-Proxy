import { NativeModules, NativeEventEmitter } from 'react-native';
import type { VPNStatusInfo, VPNConnectionStats } from '../types';

const LINKING_ERROR =
    "The package 'VPNModule' doesn't seem to be linked. Make sure:\n" +
    '- You rebuilt the app after installing the package\n' +
    '- You are not using Expo Go\n';

type NativeVPNModuleShape = {
    getProfiles(): Promise<any[]>;
    saveProfile(
        name: string,
        host: string,
        port: number,
        type: string,
        username: string,
        password: string
    ): Promise<string>;
    deleteProfile(profileId: string): Promise<void>;
    startVPN(profileId: string): Promise<void>;
    startVPNWithProfile(
        name: string,
        host: string,
        port: number,
        type: string,
        username: string,
        password: string,
        dns1?: string,
        dns2?: string
    ): Promise<void>;
    stopVPN(): Promise<void>;
    getStatus(): Promise<any>;
    refreshStatus(): void;
    addListener(eventName: string): void;
    removeListeners(count: number): void;
};

type ProfilesUpdatedPayload = {
    id?: string;
    name?: string;
    host?: string;
    port?: number;
    type?: string;
    hasAuth?: boolean;
    isUpdate?: boolean;
};

type VPNPermissionRequiredPayload = {
    profileId?: string;
    profileName?: string;
};

type ActiveProfileChangedPayload = {
    profileId?: string;
    profileName?: string;
};

const NativeVPNModule: NativeVPNModuleShape | undefined = NativeModules.VPNModule;

if (!NativeVPNModule) {
    throw new Error(LINKING_ERROR);
}

const eventEmitter = new NativeEventEmitter(NativeVPNModule as any);

type NativeStatusPayload = {
    state?: string;
    isConnected?: boolean;
    durationMillis?: number;
    bytesUp?: number;
    bytesDown?: number;
    publicIp?: string;
};

const normalizeStatus = (payload: NativeStatusPayload): VPNStatusInfo => {
    const stats: VPNConnectionStats = {
        durationMillis: Number(payload?.durationMillis) || 0,
        bytesUp: Number(payload?.bytesUp) || 0,
        bytesDown: Number(payload?.bytesDown) || 0,
        publicIp: payload?.publicIp,
    };

    if (payload?.state === 'connected' || payload?.isConnected === true) {
        return {
            state: 'connected',
            isConnected: true,
            stats,
        };
    }

    if (payload?.state === 'connecting') {
        return {
            state: 'connecting',
            isConnected: false,
            stats,
        };
    }

    if (payload?.state === 'handshaking') {
        return {
            state: 'handshaking',
            isConnected: false,
            stats,
        };
    }

    if (payload?.state === 'error') {
        return {
            state: 'error',
            isConnected: false,
            stats,
        };
    }

    return {
        state: 'disconnected',
        isConnected: false,
        stats,
    };
};

export const VPNModule = {
    getProfiles: () => NativeVPNModule.getProfiles(),
    saveProfile: (
        name: string,
        host: string,
        port: number,
        type: string,
        username: string,
        password: string
    ) => NativeVPNModule.saveProfile(name, host, port, type, username, password),
    deleteProfile: (profileId: string) => NativeVPNModule.deleteProfile(profileId),
    startVPN: (profileId: string) => NativeVPNModule.startVPN(profileId),
    startVPNWithProfile: (
        name: string,
        host: string,
        port: number,
        type: string,
        username: string,
        password: string,
        dns1?: string,
        dns2?: string
    ) => NativeVPNModule.startVPNWithProfile(name, host, port, type, username, password, dns1, dns2),
    stopVPN: () => NativeVPNModule.stopVPN(),
    getStatus: async (): Promise<VPNStatusInfo> => {
        const payload = await NativeVPNModule.getStatus();
        return normalizeStatus(payload ?? {});
    },
    refreshStatus: () => NativeVPNModule.refreshStatus(),
    addStatusChangeListener: (callback: (status: VPNStatusInfo) => void) => {
        const subscription = eventEmitter.addListener('statusChanged', (payload: NativeStatusPayload) => {
            callback(normalizeStatus(payload ?? {}));
        });
        return {
            remove: () => subscription.remove(),
        };
    },
    addErrorListener: (callback: (error: string) => void) => {
        const subscription = eventEmitter.addListener('error', (message: unknown) => {
            const errorMessage = typeof message === 'string' ? message : String(message ?? 'Unknown VPN error');
            callback(errorMessage);
        });
        return {
            remove: () => subscription.remove(),
        };
    },
    addProfilesUpdatedListener: (callback: (payload: ProfilesUpdatedPayload) => void) => {
        const subscription = eventEmitter.addListener('profilesUpdated', (payload: ProfilesUpdatedPayload) => {
            callback(payload ?? {});
        });
        return {
            remove: () => subscription.remove(),
        };
    },
    addVPNPermissionRequiredListener: (callback: (payload: VPNPermissionRequiredPayload) => void) => {
        const subscription = eventEmitter.addListener('vpnPermissionRequired', (payload: VPNPermissionRequiredPayload) => {
            callback(payload ?? {});
        });
        return {
            remove: () => subscription.remove(),
        };
    },
    addActiveProfileChangedListener: (callback: (payload: ActiveProfileChangedPayload) => void) => {
        const subscription = eventEmitter.addListener('activeProfileChanged', (payload: ActiveProfileChangedPayload) => {
            callback(payload ?? {});
        });
        return {
            remove: () => subscription.remove(),
        };
    },
};

export type VPNModuleInterface = typeof VPNModule;

export const VPNModuleEmitter = eventEmitter;

export default VPNModule;
