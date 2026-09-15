import { existsSync, readFileSync } from "node:fs";

const NUMERIC_X_ID = /^[1-9][0-9]*$/;
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;

export interface XAllocationTarget {
  handle: string;
  numericId: string;
}

function normalizeHandle(value: string): string {
  const handle = value.replace(/^@/, "");
  if (!HANDLE.test(handle)) throw new Error(`invalid X handle: ${value}`);
  return handle;
}

export function parseManualTargets(values: string[]): XAllocationTarget[] {
  const expanded = values.flatMap((value) => {
    if (!existsSync(value)) return [value];
    return readFileSync(value, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  });
  return expanded.map((value) => {
    const [rawHandle, numericId, extra] = value.split(":");
    if (!rawHandle || !numericId || extra || !NUMERIC_X_ID.test(numericId)) {
      throw new Error(`manual target must be handle:numeric_id: ${value}`);
    }
    return { handle: normalizeHandle(rawHandle), numericId };
  });
}

export async function resolveXTargets(values: string[]): Promise<XAllocationTarget[]> {
  const mode = process.env.X_LOOKUP_MODE ?? "manual";
  if (mode === "manual") return parseManualTargets(values);
  if (mode !== "live") throw new Error("X_LOOKUP_MODE must be manual or live");
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new Error("X_BEARER_TOKEN is required in live mode");
  const handles = values.map(normalizeHandle);
  const url = new URL("https://api.x.com/2/users/by");
  url.searchParams.set("usernames", handles.join(","));
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`X lookup failed with HTTP ${response.status}`);
  const json: unknown = await response.json();
  if (typeof json !== "object" || json === null || !("data" in json) || !Array.isArray(json.data)) {
    throw new Error("X lookup returned an invalid response");
  }
  const rows = new Map<string, string>();
  for (const row of json.data) {
    if (typeof row === "object" && row !== null && "username" in row && "id" in row &&
        typeof row.username === "string" && typeof row.id === "string" && NUMERIC_X_ID.test(row.id)) {
      rows.set(row.username.toLowerCase(), row.id);
    }
  }
  return handles.map((handle) => {
    const numericId = rows.get(handle.toLowerCase());
    if (!numericId) throw new Error(`X did not return @${handle}`);
    return { handle, numericId };
  });
}
