/**
 * Database types and interfaces for SQLite integration
 */

import { ProxyProfile, ProxyType } from "./index";

// ============================================================================
// Database Configuration
// ============================================================================

export interface DatabaseConfig {
  name: string;
  version: number;
  location?: string;
}

export interface DatabaseError extends Error {
  code?: string;
  sqliteCode?: number;
}

// ============================================================================
// Database Row Types (matching SQLite schema)
// ============================================================================

export interface ProfileRow {
  id: string;
  name: string;
  host: string;
  port: number;
  type: ProxyType;
  has_auth: number; // SQLite boolean (0 or 1)
  dns1: string | null;
  dns2: string | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

export interface ProfileTagRow {
  profile_id: string;
  tag: string;
}

export interface SyncLogRow {
  id: number;
  profile_id: string;
  operation: "create" | "update" | "delete";
  status: "pending" | "success" | "failed";
  error_message: string | null;
  retry_count: number;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

// ============================================================================
// Repository Interfaces
// ============================================================================

export interface IProfileRepository {
  // CRUD Operations
  create(profile: ProxyProfile): Promise<void>;
  getById(id: string): Promise<ProxyProfile | null>;
  getAll(): Promise<ProxyProfile[]>;
  update(profile: ProxyProfile): Promise<void>;
  delete(id: string): Promise<void>;

  // Batch Operations
  bulkCreate(profiles: ProxyProfile[]): Promise<BulkOperationResult>;
  bulkUpdate(profiles: ProxyProfile[]): Promise<BulkOperationResult>;
  bulkDelete(ids: string[]): Promise<BulkOperationResult>;

  // Query Operations
  search(query: string): Promise<ProxyProfile[]>;
  filterByTags(tags: string[]): Promise<ProxyProfile[]>;
  getByType(type: ProxyType): Promise<ProxyProfile[]>;
  count(): Promise<number>;

  // Tag Management
  addTag(profileId: string, tag: string): Promise<void>;
  removeTag(profileId: string, tag: string): Promise<void>;
  getTags(profileId: string): Promise<string[]>;
  getAllTags(): Promise<string[]>;
}

// ============================================================================
// Query and Filter Options
// ============================================================================

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: "name" | "created_at" | "updated_at";
  orderDirection?: "ASC" | "DESC";
}

export interface FilterOptions extends QueryOptions {
  type?: ProxyType;
  tags?: string[];
  hasAuth?: boolean;
  searchQuery?: string;
}

// ============================================================================
// Bulk Operation Results
// ============================================================================

export interface BulkOperationResult {
  success: boolean;
  totalCount: number;
  successCount: number;
  failureCount: number;
  errors: BulkOperationError[];
}

export interface BulkOperationError {
  id: string;
  error: string;
}

// ============================================================================
// Migration Types
// ============================================================================

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  failedCount: number;
  errors: string[];
  duration: number; // milliseconds
}

export interface MigrationProgress {
  total: number;
  current: number;
  percentage: number;
  currentProfile?: string;
}

// ============================================================================
// Native Sync Types
// ============================================================================

export interface SyncOperation {
  id: number;
  profileId: string;
  operation: "create" | "update" | "delete";
  status: "pending" | "success" | "failed";
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncQueueStats {
  pendingCount: number;
  failedCount: number;
  totalRetries: number;
}

export interface SyncResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: SyncError[];
}

export interface SyncError {
  profileId: string;
  operation: string;
  error: string;
  retryCount: number;
}

// ============================================================================
// Database Service Interface
// ============================================================================

export interface IDatabaseService {
  // Initialization
  initialize(): Promise<void>;
  close(): Promise<void>;
  isInitialized(): boolean;

  // Query Execution
  executeSql(
    sql: string,
    params?: any[]
  ): Promise<{ rows: any[]; rowsAffected: number }>;

  // Transaction Support
  transaction<T>(callback: (tx: ITransaction) => Promise<T>): Promise<T>;

  // Database Management
  dropAllTables(): Promise<void>;
  vacuum(): Promise<void>;
}

export interface ITransaction {
  executeSql(
    sql: string,
    params?: any[]
  ): Promise<{ rows: any[]; rowsAffected: number }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert ProfileRow to ProxyProfile
 */
export function rowToProfile(
  row: ProfileRow,
  tags: string[] = []
): ProxyProfile {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    type: row.type,
    dns1: row.dns1 || undefined,
    dns2: row.dns2 || undefined,
    tags: tags.length > 0 ? tags : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    // Note: username/password are stored in SecureStore, not in SQLite
  };
}

/**
 * Convert ProxyProfile to ProfileRow
 */
export function profileToRow(profile: ProxyProfile): ProfileRow {
  return {
    id: profile.id,
    name: profile.name,
    host: profile.host,
    port: profile.port,
    type: profile.type,
    has_auth: profile.username && profile.password ? 1 : 0,
    dns1: profile.dns1 || null,
    dns2: profile.dns2 || null,
    created_at: profile.createdAt.toISOString(),
    updated_at: profile.updatedAt.toISOString(),
  };
}

/**
 * Convert SyncLogRow to SyncOperation
 */
export function rowToSyncOperation(row: SyncLogRow): SyncOperation {
  return {
    id: row.id,
    profileId: row.profile_id,
    operation: row.operation,
    status: row.status,
    errorMessage: row.error_message || undefined,
    retryCount: row.retry_count,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}