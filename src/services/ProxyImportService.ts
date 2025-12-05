import { v4 as uuidv4 } from "uuid";
import { ProxyProfile, ProxyType } from "../types";
import { useVPNStore } from "../store";

// Maximum number of proxies that can be imported at once
// This prevents database overflow errors on mobile devices
export const MAX_PROXIES_PER_IMPORT = 500;

const mergeTags = (existing?: string[], extra?: string[]) => {
  const tags = [
    ...(existing ?? []),
    ...(extra ?? []).filter((t) => t && t.trim().length > 0),
  ];
  return tags.length > 0 ? Array.from(new Set(tags)) : undefined;
};

type ParseResult = {
  valid: ProxyProfile[];
  invalid: string[];
  duplicates: number;
  limitExceeded?: boolean;
  originalCount?: number;
};

const PROTOCOL_MAP: Record<string, ProxyType> = {
  http: "http",
  https: "http",
  socks5: "socks5",
  socks: "socks5",
};

// protocol://username:password@host:port OR protocol://host:port
const LINE_REGEX = /^(\w+):\/\/(([^:@\s]+):([^@\s]*)@)?([^:\s]+):(\d{2,5})$/i;
const LINE_NO_PROTO_REGEX = /^(([^:@\s]+):([^@\s]*)@)?([^:\s]+):(\d{2,5})$/i;

export const parseProxyLine = (line: string): ProxyProfile | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const match = trimmed.match(LINE_REGEX);
  if (!match) return null;

  const protocolRaw = match[1]?.toLowerCase();
  const type = PROTOCOL_MAP[protocolRaw];
  if (!type) return null;

  const username = match[3] ? decodeURIComponent(match[3]) : undefined;
  const password = match[4] ? decodeURIComponent(match[4]) : undefined;
  const host = match[5];
  const portNum = Number(match[6]);
  if (!host || !portNum || portNum < 1 || portNum > 65535) return null;

  const name = `${host}:${portNum}`;

  return {
    id: uuidv4(),
    name,
    host,
    port: portNum,
    type,
    username,
    password,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

export const parseProxyList = (
  text: string,
  defaultType?: ProxyType
): ParseResult => {
  const lines = text.split(/\r?\n/);
  const valid: ProxyProfile[] = [];
  const invalid: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let parsed = parseProxyLine(line);
    if (!parsed && defaultType) {
      const match = line.match(LINE_NO_PROTO_REGEX);
      if (match) {
        const username = match[2] ? decodeURIComponent(match[2]) : undefined;
        const password = match[3] ? decodeURIComponent(match[3]) : undefined;
        const host = match[4];
        const portNum = Number(match[5]);
        if (host && portNum >= 1 && portNum <= 65535) {
          parsed = {
            id: uuidv4(),
            name: `${host}:${portNum}`,
            host,
            port: portNum,
            type: defaultType,
            username,
            password,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
      }
    }
    if (parsed) {
      valid.push(parsed);
    } else {
      invalid.push(line);
    }
  }

  return { valid, invalid, duplicates: 0 };
};

const makeKey = (
  p: Pick<ProxyProfile, "type" | "host" | "port" | "username">
) => {
  return `${p.type}|${p.host}|${p.port}|${p.username ?? ""}`.toLowerCase();
};

export const dedupeProfiles = (
  incoming: ProxyProfile[],
  existing: ProxyProfile[]
): { profiles: ProxyProfile[]; duplicates: number } => {
  const seen = new Set<string>(existing.map((e) => makeKey(e)));
  let dup = 0;
  const out: ProxyProfile[] = [];
  for (const p of incoming) {
    const key = makeKey(p);
    if (seen.has(key)) {
      dup++;
      continue;
    }
    seen.add(key);
    out.push(p);
  }
  return { profiles: out, duplicates: dup };
};

export const importFromText = async (
  text: string,
  onProgress?: (current: number, total: number) => void,
  defaultType?: ProxyType,
  extraTags?: string[]
): Promise<ParseResult> => {
  const { valid, invalid } = parseProxyList(text, defaultType);
  const store = useVPNStore.getState();

  const originalCount = valid.length;
  const limitExceeded = originalCount > MAX_PROXIES_PER_IMPORT;

  // Apply limit to prevent database overflow
  const limitedValid = limitExceeded ? valid.slice(0, MAX_PROXIES_PER_IMPORT) : valid;

  // Skip deduplication for speed as requested by user
  const profiles = limitedValid.map((p) => ({
    ...p,
    tags: mergeTags(p.tags, extraTags),
  }));
  const duplicates = 0;

  const total = profiles.length;

  // Use bulk add for better performance
  await store.addProfiles(profiles);

  // Report completion
  if (onProgress) {
    onProgress(total, total);
  }

  return { 
    valid: profiles, 
    invalid, 
    duplicates,
    limitExceeded,
    originalCount: limitExceeded ? originalCount : undefined,
  };
};

export const importFromUrl = async (
  url: string,
  onProgress?: (current: number, total: number) => void,
  defaultType?: ProxyType,
  extraTags?: string[]
): Promise<ParseResult> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status}`);
  }
  const text = await res.text();
  return importFromText(text, onProgress, defaultType, extraTags);
};

export const importFromFile = async (
  onProgress?: (current: number, total: number) => void,
  defaultType?: ProxyType,
  extraTags?: string[]
): Promise<ParseResult> => {
  try {
    // Try dynamic import to avoid hard dependency
    const DocumentPicker = await import("expo-document-picker");
    const result = await DocumentPicker.getDocumentAsync({
      type: "text/plain",
      multiple: false,
      copyToCacheDirectory: true,
    } as any);

    // Newer API returns an object with assets
    let uri: string | undefined;
    if (result && (result as any).assets && (result as any).assets[0]) {
      uri = (result as any).assets[0].uri as string;
    } else if ((result as any).uri) {
      uri = (result as any).uri as string;
    }

    if (!uri) {
      throw new Error("No file selected");
    }

    const fileRes = await fetch(uri);
    const text = await fileRes.text();
    return importFromText(text, onProgress, defaultType, extraTags);
  } catch (err) {
    throw new Error(
      "File import requires expo-document-picker. Please install it to use this feature."
    );
  }
};
