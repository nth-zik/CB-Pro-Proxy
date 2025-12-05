export type ProxyHealthStatus = "unknown" | "checking" | "ok" | "fail" | "unsupported";

export type ProxyHealth = {
  status: ProxyHealthStatus;
  latencyMs?: number;
  error?: string;
  checkedAt?: number;
};

