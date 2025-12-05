import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";
import { ProxySource, ProxyType } from "../types";
import { importFromUrl } from "./ProxyImportService";
import { logger } from "./LoggerService";

const SOURCES_STORAGE_KEY = "@cbv_proxy_sources";

export interface FetchResult {
  success: boolean;
  addedCount: number;
  duplicatesCount: number;
  invalidCount: number;
  error?: string;
  limitExceeded?: boolean;
  originalCount?: number;
}

class ProxySourceService {
  private fetchIntervalId: NodeJS.Timeout | null = null;
  private isPeriodicFetchRunning = false;

  /**
   * Get all saved proxy sources
   */
  async getSources(): Promise<ProxySource[]> {
    try {
      const data = await AsyncStorage.getItem(SOURCES_STORAGE_KEY);
      if (!data) return [];

      const sources: ProxySource[] = JSON.parse(data);
      // Convert date strings back to Date objects
      return sources.map((s) => ({
        ...s,
        lastFetchAt: s.lastFetchAt ? new Date(s.lastFetchAt) : undefined,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      }));
    } catch (error) {
      logger.error("Failed to get proxy sources", "proxySource", error as Error);
      return [];
    }
  }

  /**
   * Save all proxy sources
   */
  async saveSources(sources: ProxySource[]): Promise<void> {
    try {
      await AsyncStorage.setItem(SOURCES_STORAGE_KEY, JSON.stringify(sources));
    } catch (error) {
      logger.error("Failed to save proxy sources", "proxySource", error as Error);
      throw error;
    }
  }

  /**
   * Add a new proxy source
   */
  async addSource(
    name: string,
    url: string,
    options?: {
      defaultProtocol?: ProxyType;
      tags?: string[];
      autoFetch?: boolean;
      fetchIntervalHours?: number;
    }
  ): Promise<ProxySource> {
    const sources = await this.getSources();

    const newSource: ProxySource = {
      id: uuidv4(),
      name: name.trim(),
      url: url.trim(),
      defaultProtocol: options?.defaultProtocol,
      tags: options?.tags,
      autoFetch: options?.autoFetch ?? true,
      fetchIntervalHours: options?.fetchIntervalHours ?? 24,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    sources.push(newSource);
    await this.saveSources(sources);

    logger.info("Added new proxy source", "proxySource", {
      id: newSource.id,
      name: newSource.name,
      url: newSource.url,
    });

    return newSource;
  }

  /**
   * Update an existing proxy source
   */
  async updateSource(
    id: string,
    updates: Partial<Omit<ProxySource, "id" | "createdAt">>
  ): Promise<ProxySource | null> {
    const sources = await this.getSources();
    const index = sources.findIndex((s) => s.id === id);

    if (index === -1) {
      return null;
    }

    sources[index] = {
      ...sources[index],
      ...updates,
      updatedAt: new Date(),
    };

    await this.saveSources(sources);
    return sources[index];
  }

  /**
   * Delete a proxy source
   */
  async deleteSource(id: string): Promise<boolean> {
    const sources = await this.getSources();
    const filtered = sources.filter((s) => s.id !== id);

    if (filtered.length === sources.length) {
      return false;
    }

    await this.saveSources(filtered);
    logger.info("Deleted proxy source", "proxySource", { id });
    return true;
  }

  /**
   * Fetch proxies from a single source
   */
  async fetchFromSource(source: ProxySource): Promise<FetchResult> {
    try {
      logger.info("Fetching proxies from source", "proxySource", {
        id: source.id,
        name: source.name,
        url: source.url,
      });

      const result = await importFromUrl(
        source.url,
        undefined, // no progress callback
        source.defaultProtocol,
        source.tags
      );

      // Update source with fetch result
      await this.updateSource(source.id, {
        lastFetchAt: new Date(),
        lastFetchStatus: "success",
        lastFetchError: undefined,
        proxiesCount: result.valid.length,
      });

      // Log warning if limit was exceeded
      if (result.limitExceeded) {
        logger.warn("Proxy limit exceeded, some proxies were skipped", "proxySource", {
          id: source.id,
          name: source.name,
          imported: result.valid.length,
          original: result.originalCount,
        });
      }

      logger.info("Successfully fetched proxies from source", "proxySource", {
        id: source.id,
        name: source.name,
        added: result.valid.length,
        duplicates: result.duplicates,
        invalid: result.invalid.length,
        limitExceeded: result.limitExceeded,
      });

      return {
        success: true,
        addedCount: result.valid.length,
        duplicatesCount: result.duplicates,
        invalidCount: result.invalid.length,
        limitExceeded: result.limitExceeded,
        originalCount: result.originalCount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update source with error
      await this.updateSource(source.id, {
        lastFetchAt: new Date(),
        lastFetchStatus: "error",
        lastFetchError: errorMessage,
      });

      logger.error("Failed to fetch proxies from source", "proxySource", error as Error, {
        id: source.id,
        name: source.name,
      });

      return {
        success: false,
        addedCount: 0,
        duplicatesCount: 0,
        invalidCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Fetch proxies from all sources with autoFetch enabled
   */
  async fetchAllAutoSources(): Promise<Map<string, FetchResult>> {
    const sources = await this.getSources();
    const autoSources = sources.filter((s) => s.autoFetch);
    const results = new Map<string, FetchResult>();

    for (const source of autoSources) {
      // Check if it's time to fetch (based on interval)
      if (source.lastFetchAt) {
        const hoursSinceLastFetch =
          (Date.now() - new Date(source.lastFetchAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastFetch < source.fetchIntervalHours) {
          continue; // Skip, not time yet
        }
      }

      const result = await this.fetchFromSource(source);
      results.set(source.id, result);
    }

    return results;
  }

  /**
   * Start periodic fetch (call on app startup)
   */
  startPeriodicFetch(checkIntervalMinutes: number = 60): void {
    if (this.fetchIntervalId) {
      return; // Already running
    }

    logger.info("Starting periodic proxy source fetch", "proxySource", {
      checkIntervalMinutes,
    });

    // Check immediately on startup
    this.runPeriodicFetch();

    // Then check every hour
    this.fetchIntervalId = setInterval(() => {
      this.runPeriodicFetch();
    }, checkIntervalMinutes * 60 * 1000);
  }

  /**
   * Stop periodic fetch
   */
  stopPeriodicFetch(): void {
    if (this.fetchIntervalId) {
      clearInterval(this.fetchIntervalId);
      this.fetchIntervalId = null;
      logger.info("Stopped periodic proxy source fetch", "proxySource");
    }
  }

  /**
   * Run the periodic fetch (internal)
   */
  private async runPeriodicFetch(): Promise<void> {
    if (this.isPeriodicFetchRunning) {
      return; // Prevent concurrent runs
    }

    this.isPeriodicFetchRunning = true;

    try {
      const results = await this.fetchAllAutoSources();
      if (results.size > 0) {
        logger.info("Periodic fetch completed", "proxySource", {
          sourcesChecked: results.size,
        });
      }
    } catch (error) {
      logger.error("Periodic fetch failed", "proxySource", error as Error);
    } finally {
      this.isPeriodicFetchRunning = false;
    }
  }
}

export const proxySourceService = new ProxySourceService();
