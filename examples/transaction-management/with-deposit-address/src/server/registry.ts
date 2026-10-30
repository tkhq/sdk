import { promises as fs } from "fs";
import * as path from "path";
import type { Address } from "viem";
import { parseAddress } from "@/lib/deposit";

// Maps each enabled deposit address to its sub-organization. A JSON file is
// enough for the demo; use a database in production.
const REGISTRY_PATH = path.resolve(
  process.cwd(),
  "data/deposit-addresses.json",
);

export type DepositAddressEntry = {
  address: Address;
  subOrgId: string;
  delegatedUserId: string;
  registeredAt: string;
};

type Registry = Record<string, DepositAddressEntry>;

function isEntry(v: unknown): v is DepositAddressEntry {
  return (
    typeof v === "object" &&
    v !== null &&
    "address" in v &&
    typeof v.address === "string" &&
    parseAddress(v.address) === v.address &&
    "subOrgId" in v &&
    typeof v.subOrgId === "string" &&
    "delegatedUserId" in v &&
    typeof v.delegatedUserId === "string" &&
    "registeredAt" in v &&
    typeof v.registeredAt === "string"
  );
}

async function read(): Promise<Registry> {
  let raw: string;
  try {
    raw = await fs.readFile(REGISTRY_PATH, "utf8");
  } catch {
    return {};
  }
  const parsed: unknown = JSON.parse(raw);
  const registry: Registry = {};
  if (typeof parsed === "object" && parsed !== null) {
    for (const entry of Object.values(parsed)) {
      if (isEntry(entry)) registry[entry.address] = entry;
    }
  }
  return registry;
}

// Serialize writes so two registrations cannot overwrite each other.
let writeQueue: Promise<unknown> = Promise.resolve();

export function saveDepositAddress(entry: DepositAddressEntry) {
  const write = writeQueue.then(async () => {
    const registry = await read();
    registry[entry.address] = entry;
    await fs.mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
    const tmp = `${REGISTRY_PATH}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(registry, null, 2));
    await fs.rename(tmp, REGISTRY_PATH);
  });
  writeQueue = write.catch(() => undefined);
  return write;
}

export async function findDepositAddress(
  address: string,
): Promise<DepositAddressEntry | null> {
  const key = parseAddress(address);
  if (!key) return null;
  return (await read())[key] ?? null;
}

export async function listDepositAddresses(): Promise<DepositAddressEntry[]> {
  return Object.values(await read()).sort((a, b) =>
    b.registeredAt.localeCompare(a.registeredAt),
  );
}
