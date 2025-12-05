/**
 * DatabaseService - SQLite database management
 * 
 * Handles database initialization, schema creation, and query execution.
 * Provides transaction support and error handling for all database operations.
 */

import * as SQLite from "expo-sqlite";
import {
  DatabaseConfig,
  DatabaseError,
  IDatabaseService,
  ITransaction,
} from "../types/database";
import { logger } from "./LoggerService";

const DEFAULT_CONFIG: DatabaseConfig = {
  name: "cbv_vpn.db",
  version: 1,
};

/**
 * Database schema SQL statements
 */
const SCHEMA_SQL = {
  // Profiles table - stores proxy profile metadata
  createProfilesTable: `
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('socks5', 'http')),
      has_auth INTEGER NOT NULL DEFAULT 0 CHECK(has_auth IN (0, 1)),
      dns1 TEXT,
      dns2 TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,

  // Profile tags table - many-to-many relationship
  createProfileTagsTable: `
    CREATE TABLE IF NOT EXISTS profile_tags (
      profile_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (profile_id, tag),
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `,

  // Sync log table - tracks native module synchronization
  createSyncLogTable: `
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
      status TEXT NOT NULL CHECK(status IN ('pending', 'success', 'failed')),
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `,

  // Indexes for performance
  createIndexes: [
    "CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(name);",
    "CREATE INDEX IF NOT EXISTS idx_profiles_type ON profiles(type);",
    "CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);",
    "CREATE INDEX IF NOT EXISTS idx_profile_tags_tag ON profile_tags(tag);",
    "CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status);",
    "CREATE INDEX IF NOT EXISTS idx_sync_log_profile_id ON sync_log(profile_id);",
  ],
};

/**
 * Transaction wrapper for expo-sqlite
 */
class Transaction implements ITransaction {
  constructor(private tx: SQLite.SQLTransactionAsync) {}

  async executeSql(
    sql: string,
    params: any[] = []
  ): Promise<{ rows: any[]; rowsAffected: number }> {
    try {
      const result = await this.tx.executeSqlAsync(sql, params);
      const rows: any[] = [];
      
      // Extract rows from result - support multiple shapes
      // Some drivers (expo-sqlite) return a WebSQL-style rowset with an `item(i)` accessor
      // Others may return a plain array of row objects. Handle both safely.
      if (result.rows) {
        const rr: any = result.rows;
        if (Array.isArray(rr)) {
          // direct array of rows
          rows.push(...rr);
        } else if (typeof rr.item === "function") {
          // WebSQL-like result set
          for (let i = 0; i < rr.length; i++) {
            rows.push(rr.item(i));
          }
        } else if (typeof rr.length === "number") {
          // array-like shape without item fn (safeguard)
          for (let i = 0; i < rr.length; i++) {
            rows.push(rr[i]);
          }
        }
      }

      return {
        rows,
        rowsAffected: result.rowsAffected || 0,
      };
    } catch (error) {
      const dbError = this.createDatabaseError(error, sql);
      logger.error("Transaction SQL execution failed", "database", dbError, {
        sql,
        params,
      });
      throw dbError;
    }
  }

  private createDatabaseError(error: any, sql: string): DatabaseError {
    const dbError = new Error(
      `Database error: ${error.message || "Unknown error"}`
    ) as DatabaseError;
    dbError.code = error.code;
    dbError.sqliteCode = error.sqliteCode;
    dbError.name = "DatabaseError";
    return dbError;
  }
}

/**
 * DatabaseService implementation
 */
export class DatabaseService implements IDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private config: DatabaseConfig;
  private initialized = false;

  constructor(config: Partial<DatabaseConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize database and create schema
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug("Database already initialized", "database");
      return;
    }

    try {
      logger.info("Initializing SQLite database", "database", {
        name: this.config.name,
        version: this.config.version,
      });

      // Open database
      this.db = await SQLite.openDatabaseAsync(this.config.name);

      // Enable foreign keys
      await this.db.execAsync("PRAGMA foreign_keys = ON;");

      // Create schema
      await this.createSchema();

      this.initialized = true;
      logger.info("Database initialized successfully", "database");
    } catch (error) {
      const dbError = this.createDatabaseError(error, "initialize");
      logger.error("Failed to initialize database", "database", dbError);
      throw dbError;
    }
  }

  /**
   * Create database schema
   */
  private async createSchema(): Promise<void> {
    if (!this.db) {
      throw new Error("Database not opened");
    }

    try {
      await this.db.execAsync(`
        BEGIN TRANSACTION;
        
        ${SCHEMA_SQL.createProfilesTable}
        ${SCHEMA_SQL.createProfileTagsTable}
        ${SCHEMA_SQL.createSyncLogTable}
        ${SCHEMA_SQL.createIndexes.join("\n")}
        
        COMMIT;
      `);

      logger.debug("Database schema created", "database");
    } catch (error) {
      logger.error("Failed to create schema", "database", error as Error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.closeAsync();
        this.db = null;
        this.initialized = false;
        logger.info("Database closed", "database");
      } catch (error) {
        logger.error("Failed to close database", "database", error as Error);
        throw error;
      }
    }
  }

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.db !== null;
  }

  /**
   * Execute SQL query
   */
  async executeSql(
    sql: string,
    params: any[] = []
  ): Promise<{ rows: any[]; rowsAffected: number }> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    try {
      const result = await this.db.runAsync(sql, params);
      const rows: any[] = [];

      // For SELECT queries, fetch all rows
      if (sql.trim().toUpperCase().startsWith("SELECT")) {
        const allRows = await this.db.getAllAsync(sql, params);
        rows.push(...allRows);
      }

      return {
        rows,
        rowsAffected: result.changes || 0,
      };
    } catch (error) {
      const dbError = this.createDatabaseError(error, sql);
      logger.error("SQL execution failed", "database", dbError, {
        sql,
        params,
      });
      throw dbError;
    }
  }

  /**
   * Execute transaction
   */
  async transaction<T>(
    callback: (tx: ITransaction) => Promise<T>
  ): Promise<T> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    try {
      return await this.db.withTransactionAsync(async (tx: SQLite.SQLTransactionAsync) => {
        const transaction = new Transaction(tx);
        return await callback(transaction);
      });
    } catch (error) {
      const dbError = this.createDatabaseError(error, "transaction");
      logger.error("Transaction failed", "database", dbError);
      throw dbError;
    }
  }

  /**
   * Drop all tables (for testing/reset)
   */
  async dropAllTables(): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    try {
      await this.db.execAsync(`
        BEGIN TRANSACTION;
        
        DROP TABLE IF EXISTS sync_log;
        DROP TABLE IF EXISTS profile_tags;
        DROP TABLE IF EXISTS profiles;
        
        COMMIT;
      `);

      logger.info("All tables dropped", "database");
    } catch (error) {
      logger.error("Failed to drop tables", "database", error as Error);
      throw error;
    }
  }

  /**
   * Vacuum database to reclaim space
   */
  async vacuum(): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    try {
      await this.db.execAsync("VACUUM;");
      logger.info("Database vacuumed", "database");
    } catch (error) {
      logger.error("Failed to vacuum database", "database", error as Error);
      throw error;
    }
  }

  /**
   * Create DatabaseError from generic error
   */
  private createDatabaseError(error: any, context: string): DatabaseError {
    const message = error.message || "Unknown database error";
    const dbError = new Error(
      `Database error in ${context}: ${message}`
    ) as DatabaseError;
    dbError.code = error.code;
    dbError.sqliteCode = error.sqliteCode;
    dbError.name = "DatabaseError";
    return dbError;
  }

  /**
   * Get database instance (for advanced usage)
   */
  getDatabase(): SQLite.SQLiteDatabase | null {
    return this.db;
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();