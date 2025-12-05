import { create } from "zustand";
import { ProxySource, ProxyType } from "../types";
import { proxySourceService, FetchResult } from "../services/ProxySourceService";
import { logger } from "../services/LoggerService";

interface ProxySourceStore {
  // State
  sources: ProxySource[];
  isLoading: boolean;
  isFetching: boolean;
  fetchingSourceIds: Set<string>;

  // Actions
  loadSources: () => Promise<void>;
  addSource: (
    name: string,
    url: string,
    options?: {
      defaultProtocol?: ProxyType;
      tags?: string[];
      autoFetch?: boolean;
      fetchIntervalHours?: number;
    }
  ) => Promise<ProxySource>;
  updateSource: (
    id: string,
    updates: Partial<Omit<ProxySource, "id" | "createdAt">>
  ) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  refetchSource: (id: string) => Promise<FetchResult>;
  refetchAllSources: () => Promise<Map<string, FetchResult>>;
}

export const useProxySourceStore = create<ProxySourceStore>((set, get) => ({
  // Initial state
  sources: [],
  isLoading: false,
  isFetching: false,
  fetchingSourceIds: new Set(),

  loadSources: async () => {
    set({ isLoading: true });
    try {
      const sources = await proxySourceService.getSources();
      set({ sources, isLoading: false });
    } catch (error) {
      logger.error("Failed to load proxy sources", "proxySource", error as Error);
      set({ isLoading: false });
    }
  },

  addSource: async (name, url, options) => {
    const newSource = await proxySourceService.addSource(name, url, options);
    set((state) => ({
      sources: [...state.sources, newSource],
    }));
    return newSource;
  },

  updateSource: async (id, updates) => {
    const updated = await proxySourceService.updateSource(id, updates);
    if (updated) {
      set((state) => ({
        sources: state.sources.map((s) => (s.id === id ? updated : s)),
      }));
    }
  },

  deleteSource: async (id) => {
    await proxySourceService.deleteSource(id);
    set((state) => ({
      sources: state.sources.filter((s) => s.id !== id),
    }));
  },

  refetchSource: async (id) => {
    const source = get().sources.find((s) => s.id === id);
    if (!source) {
      return {
        success: false,
        addedCount: 0,
        duplicatesCount: 0,
        invalidCount: 0,
        error: "Source not found",
      };
    }

    // Mark as fetching
    set((state) => ({
      isFetching: true,
      fetchingSourceIds: new Set([...state.fetchingSourceIds, id]),
    }));

    try {
      const result = await proxySourceService.fetchFromSource(source);

      // Reload sources to get updated lastFetchAt etc.
      const sources = await proxySourceService.getSources();

      set((state) => {
        const newFetchingIds = new Set(state.fetchingSourceIds);
        newFetchingIds.delete(id);
        return {
          sources,
          isFetching: newFetchingIds.size > 0,
          fetchingSourceIds: newFetchingIds,
        };
      });

      return result;
    } catch (error) {
      set((state) => {
        const newFetchingIds = new Set(state.fetchingSourceIds);
        newFetchingIds.delete(id);
        return {
          isFetching: newFetchingIds.size > 0,
          fetchingSourceIds: newFetchingIds,
        };
      });

      return {
        success: false,
        addedCount: 0,
        duplicatesCount: 0,
        invalidCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  refetchAllSources: async () => {
    const sources = get().sources;
    const results = new Map<string, FetchResult>();

    set({ isFetching: true });

    for (const source of sources) {
      set((state) => ({
        fetchingSourceIds: new Set([...state.fetchingSourceIds, source.id]),
      }));

      const result = await proxySourceService.fetchFromSource(source);
      results.set(source.id, result);

      set((state) => {
        const newFetchingIds = new Set(state.fetchingSourceIds);
        newFetchingIds.delete(source.id);
        return { fetchingSourceIds: newFetchingIds };
      });
    }

    // Reload sources to get updated data
    const updatedSources = await proxySourceService.getSources();
    set({ sources: updatedSources, isFetching: false });

    return results;
  },
}));
