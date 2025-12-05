import { create } from "zustand";
import { ProxyProfile } from "../types";
import { ProxyHealth, ProxyHealthStatus } from "../types/health";
import { VPNModule } from "../native/VPNModule";

type HealthMap = Record<string, ProxyHealth>;

interface ProxyHealthStore {
  health: HealthMap;
  isChecking: Set<string>;
  checkQueue: ProxyProfile[];
  isProcessingQueue: boolean;
  enqueueCheck: (profile: ProxyProfile) => void;
  processQueue: () => Promise<void>;
  checkProfileHealth: (profile: ProxyProfile) => Promise<ProxyHealth>;
  checkAll: (profiles: ProxyProfile[]) => Promise<void>;
  setHealth: (id: string, health: ProxyHealth) => void;
  clear: () => void;
}

const MAX_CONCURRENT = 10; // Run 10 checks in parallel for maximum speed
const HEALTH_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_DELAY_MS = 0; // No delay for maximum speed

export const useProxyHealthStore = create<ProxyHealthStore>((set, get) => ({
  health: {},
  isChecking: new Set<string>(),
  checkQueue: [],
  isProcessingQueue: false,

  setHealth: (id, h) => {
    set((s) => ({
      health: { ...s.health, [id]: { ...h, checkedAt: Date.now() } },
    }));
  },
  clear: () =>
    set({
      health: {},
      isChecking: new Set<string>(),
      checkQueue: [],
      isProcessingQueue: false,
    }),

  enqueueCheck: (profile) => {
    const state = get();
    const id = profile.id;

    // Skip if already checking or already in queue
    if (state.isChecking.has(id) || state.checkQueue.some((p) => p.id === id))
      return;

    // Check TTL
    const already = state.health[id];
    if (
      already &&
      already.checkedAt &&
      Date.now() - already.checkedAt < HEALTH_TTL_MS
    )
      return;

    set({ checkQueue: [...state.checkQueue, profile] });

    // Trigger processing
    get().processQueue();
  },

  processQueue: async () => {
    if (get().isProcessingQueue) return;
    set({ isProcessingQueue: true });

    try {
      while (get().checkQueue.length > 0) {
        // Get first item
        const profile = get().checkQueue[0];

        // Remove from queue
        set((s) => ({ checkQueue: s.checkQueue.slice(1) }));

        if (!profile) continue;

        // Delay to prevent CPU hogging
        await new Promise((resolve) => setTimeout(resolve, CHECK_DELAY_MS));

        await get().checkProfileHealth(profile);
      }
    } finally {
      set({ isProcessingQueue: false });
    }
  },

  checkProfileHealth: async (profile) => {
    const id = profile.id;
    const state = get();
    if (state.isChecking.has(id)) {
      return state.health[id] ?? { status: "checking" };
    }
    set({ isChecking: new Set([...state.isChecking, id]) });
    try {
      const payload = await (VPNModule as any).checkProxyHealth?.(
        profile.type,
        profile.host,
        profile.port,
        profile.username ?? "",
        profile.password ?? ""
      );
      if (!payload) {
        const res: ProxyHealth = { status: "unsupported" };
        get().setHealth(id, res);
        return res;
      }
      const status: ProxyHealthStatus = payload.ok ? "ok" : "fail";
      const res: ProxyHealth = {
        status,
        latencyMs: payload.latencyMs,
        error: payload.error,
      };
      get().setHealth(id, res);
      return res;
    } catch (e: any) {
      let errorMessage = "Unknown error";
      if (typeof e === "string") {
        errorMessage = e;
      } else if (e instanceof Error) {
        errorMessage = e.message;
      } else if (typeof e === "object" && e !== null) {
        // Handle error objects that might be { error: "..." } or similar
        errorMessage = e.message || e.error || JSON.stringify(e);
      } else {
        errorMessage = String(e);
      }

      const res: ProxyHealth = {
        status: "fail",
        error: errorMessage,
      };
      get().setHealth(id, res);
      return res;
    } finally {
      const next = new Set(get().isChecking);
      next.delete(id);
      set({ isChecking: next });
    }
  },

  checkAll: async (profiles) => {
    const queue = [...profiles];
    const runners: Promise<void>[] = [];
    for (let i = 0; i < MAX_CONCURRENT; i++) {
      const run = async () => {
        while (queue.length) {
          const p = queue.shift();
          if (!p) break;
          // Yield to event loop and delay to reduce CPU usage
          await new Promise((resolve) => setTimeout(resolve, CHECK_DELAY_MS));
          await get().checkProfileHealth(p);
        }
      };
      runners.push(run());
    }
    await Promise.all(runners);
  },
}));
