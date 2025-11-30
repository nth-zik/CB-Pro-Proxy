// Core type definitions for CBV VPN App

export type ProxyType = "socks5" | "http";

export type VPNStatus =
  | "disconnected"
  | "connecting"
  | "handshaking"
  | "connected"
  | "proxy_error"
  | "error";

export interface VPNConnectionStats {
  durationMillis: number;
  bytesUp: number;
  bytesDown: number;
  publicIp?: string;
}

export interface VPNStatusInfo {
  state: VPNStatus;
  isConnected: boolean;
  stats: VPNConnectionStats;
}

export interface ProxyProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  type: ProxyType;
  username?: string;
  password?: string;
  dns1?: string;
  dns2?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VPNState {
  status: VPNStatus;
  activeProfileId?: string;
  error?: string;
  connectedAt?: Date;
  bytesIn?: number;
  bytesOut?: number;
}

export interface VPNModuleInterface {
  // Profile Management
  saveProfile(profile: ProxyProfile): Promise<void>;
  getProfiles(): Promise<ProxyProfile[]>;
  deleteProfile(id: string): Promise<void>;

  // VPN Control
  startVPN(profileId: string): Promise<void>;
  stopVPN(force?: boolean): Promise<void>;
  getStatus(): Promise<VPNStatusInfo>;

  // Events
  addListener(
    event: "statusChanged" | "error",
    callback: (data: any) => void
  ): void;
  removeListener(event: string, callback: (data: any) => void): void;
}

export interface StoredProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  type: ProxyType;
  hasAuth: boolean;
}

export interface StoredCredentials {
  profileId: string;
  username: string;
  password: string;
}

// Type Guards
export function isProxyType(value: unknown): value is ProxyType {
  return value === "socks5" || value === "http";
}

export function isVPNStatus(value: unknown): value is VPNStatus {
  return (
    value === "disconnected" ||
    value === "connecting" ||
    value === "handshaking" ||
    value === "connected" ||
    value === "error"
  );
}

export function isVPNConnectionStats(
  value: unknown
): value is VPNConnectionStats {
  if (typeof value !== "object" || value === null) return false;
  const stats = value as Record<string, unknown>;
  return (
    typeof stats.durationMillis === "number" &&
    typeof stats.bytesUp === "number" &&
    typeof stats.bytesDown === "number"
  );
}

export function isVPNStatusInfo(value: unknown): value is VPNStatusInfo {
  if (typeof value !== "object" || value === null) return false;
  const info = value as Record<string, unknown>;
  return (
    isVPNStatus(info.state) &&
    typeof info.isConnected === "boolean" &&
    isVPNConnectionStats(info.stats)
  );
}

export function isProxyProfile(value: unknown): value is ProxyProfile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const profile = value as Record<string, unknown>;

  return (
    typeof profile.id === "string" &&
    typeof profile.name === "string" &&
    typeof profile.host === "string" &&
    typeof profile.port === "number" &&
    isProxyType(profile.type) &&
    (profile.username === undefined || typeof profile.username === "string") &&
    (profile.password === undefined || typeof profile.password === "string") &&
    (profile.createdAt instanceof Date ||
      typeof profile.createdAt === "string") &&
    (profile.updatedAt instanceof Date || typeof profile.updatedAt === "string")
  );
}

export function isVPNState(value: unknown): value is VPNState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const state = value as Record<string, unknown>;

  return (
    isVPNStatus(state.status) &&
    (state.activeProfileId === undefined ||
      typeof state.activeProfileId === "string") &&
    (state.error === undefined || typeof state.error === "string") &&
    (state.connectedAt === undefined ||
      state.connectedAt instanceof Date ||
      typeof state.connectedAt === "string") &&
    (state.bytesIn === undefined || typeof state.bytesIn === "number") &&
    (state.bytesOut === undefined || typeof state.bytesOut === "number")
  );
}

// Validation Helpers
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateProxyProfile(
  profile: Partial<ProxyProfile>
): ValidationResult {
  const errors: string[] = [];

  // Validate name
  if (!profile.name || profile.name.trim().length === 0) {
    errors.push("Profile name is required");
  } else if (profile.name.length > 100) {
    errors.push("Profile name must be less than 100 characters");
  }

  // Validate host
  if (!profile.host || profile.host.trim().length === 0) {
    errors.push("Proxy host is required");
  } else {
    // Basic hostname/IP validation
    const hostPattern =
      /^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?|(?:\d{1,3}\.){3}\d{1,3})$/;
    if (!hostPattern.test(profile.host.trim())) {
      errors.push("Invalid proxy host format");
    }
  }

  // Validate port
  if (profile.port === undefined || profile.port === null) {
    errors.push("Proxy port is required");
  } else if (
    !Number.isInteger(profile.port) ||
    profile.port < 1 ||
    profile.port > 65535
  ) {
    errors.push("Proxy port must be between 1 and 65535");
  }

  // Validate type
  if (!profile.type) {
    errors.push("Proxy type is required");
  } else if (!isProxyType(profile.type)) {
    errors.push('Proxy type must be either "socks5" or "http"');
  }

  // Validate username and password (both or neither)
  if (profile.username && !profile.password) {
    errors.push("Password is required when username is provided");
  }
  if (profile.password && !profile.username) {
    errors.push("Username is required when password is provided");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateHost(host: string): boolean {
  if (!host || host.trim().length === 0) {
    return false;
  }

  // Hostname or IP address pattern
  const hostPattern =
    /^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?|(?:\d{1,3}\.){3}\d{1,3})$/;
  return hostPattern.test(host.trim());
}

export function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function sanitizeProfileInput(
  input: Partial<ProxyProfile>
): Partial<ProxyProfile> {
  return {
    ...input,
    name: input.name?.trim(),
    host: input.host?.trim(),
    username: input.username?.trim() || undefined,
    password: input.password || undefined,
  };
}

// Error types
export * from "./errors";

// Logging types
export * from "./logging";

// Theme types
export * from "./theme";

// Modal types
export * from "./modal";
