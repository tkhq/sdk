import { Turnkey } from "@turnkey/sdk-server";
import { TronWeb } from "tronweb";

// Tron's signing digest is sha256(raw_data). Turnkey hashes the raw_data_hex
// payload with HASH_FUNCTION_SHA256 and signs the result with the secp256k1
// key behind `signWith`, so no key material ever leaves Turnkey.
export type TronTransaction = {
  txID: string;
  raw_data: unknown;
  raw_data_hex: string;
  visible?: boolean;
};

export type SignedTronTransaction = TronTransaction & { signature: string[] };

export function initTurnkey(): Turnkey {
  return new Turnkey({
    apiBaseUrl: process.env.BASE_URL ?? "https://api.turnkey.com",
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });
}

export function initTronWeb(): TronWeb {
  // Defaults to mainnet; set a TRONGRID_API_KEY — TronGrid throttles
  // anonymous mainnet traffic hard. For the Nile testnet set
  // TRON_FULL_HOST=https://nile.trongrid.io (TronSave only, via its dev API;
  // JustLend has no testnet deployment).
  const apiKey = process.env.TRONGRID_API_KEY;
  return new TronWeb({
    fullHost: process.env.TRON_FULL_HOST ?? "https://api.trongrid.io",
    ...(apiKey ? { headers: { "TRON-PRO-API-KEY": apiKey } } : {}),
  });
}

/** Explorer link for a transaction, matching the configured network. */
export function explorerTxUrl(txid: string): string {
  const host = process.env.TRON_FULL_HOST ?? "";
  const base = host.includes("nile")
    ? "https://nile.tronscan.org"
    : "https://tronscan.org";
  return `${base}/#/transaction/${txid}`;
}

/**
 * Convert an energy amount into the SUN of staked TRX that currently yields
 * it. Delegations (and JustLend rentals) are denominated in staked balance,
 * not energy, and the ratio (TotalEnergyLimit / TotalEnergyWeight) floats
 * with network-wide stake, so it must be read live rather than hardcoded.
 */
export async function energyToDelegatableSun(
  tronWeb: TronWeb,
  energy: number,
  refAddress: string,
): Promise<number> {
  const resources = await tronWeb.trx.getAccountResources(refAddress);
  const energyPerStakedTrx =
    (resources.TotalEnergyLimit ?? 0) / (resources.TotalEnergyWeight ?? 1);
  if (!Number.isFinite(energyPerStakedTrx) || energyPerStakedTrx <= 0) {
    throw new Error("could not read the network energy/stake ratio");
  }
  return Math.ceil(energy / energyPerStakedTrx) * 1_000_000;
}

export async function signTronTransaction<T extends TronTransaction>(
  turnkeyClient: Turnkey,
  signWith: string,
  transaction: T,
): Promise<T & { signature: string[] }> {
  const { r, s, v } = await turnkeyClient.apiClient().signRawPayload({
    organizationId: process.env.ORGANIZATION_ID!,
    signWith,
    payload: transaction.raw_data_hex,
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
  });
  return { ...transaction, signature: [r + s + v] };
}

/** Node error messages come back hex-encoded. */
function decodeNodeMessage(message: string | undefined): string {
  if (!message) return "";
  if (message.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(message)) {
    return message;
  }
  return Buffer.from(message, "hex").toString();
}

export async function broadcast(
  tronWeb: TronWeb,
  signed: SignedTronTransaction,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await tronWeb.trx.sendRawTransaction(signed as any);
  if (!result.result) {
    const detail = decodeNodeMessage(result.message) || result.code;
    throw new Error(`broadcast failed: ${detail}`);
  }
  return result.txid ?? signed.txID;
}

/** Positive number from the environment, rejecting values that parse to NaN. */
export function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number, got "${raw}"`);
  }
  return value;
}

// Broadcast acceptance is not execution: a transaction can be included and
// still fail on-chain (e.g. OUT_OF_ENERGY). Poll the receipt and surface the
// on-chain failure reason.
export async function waitForConfirmation(
  tronWeb: TronWeb,
  txid: string,
  timeoutMs = 90_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let info: any;
    try {
      info = await tronWeb.trx.getTransactionInfo(txid);
    } catch {
      // A transient node error must not abort the poll: the caller may hold an
      // unsettled rental whose only release path is this function returning.
      continue;
    }
    if (!info?.id) continue; // not included yet
    const receipt = info.receipt?.result;
    if (info.result === "FAILED" || (receipt && receipt !== "SUCCESS")) {
      throw new Error(
        `tx ${txid} failed on-chain: ${receipt ?? "FAILED"} ${decodeNodeMessage(info.resMessage)}`,
      );
    }
    return;
  }
  throw new Error(`tx ${txid} not confirmed within ${timeoutMs / 1000}s`);
}

/** Energy the account can spend right now (own stake + delegations), net of usage. */
export async function availableEnergy(
  tronWeb: TronWeb,
  address: string,
): Promise<number> {
  const resources = await tronWeb.trx.getAccountResources(address);
  return (resources.EnergyLimit ?? 0) - (resources.EnergyUsed ?? 0);
}

/**
 * Bandwidth the account can spend right now. Energy providers delegate energy
 * only; bandwidth is a separate resource, and the free allowance (600/day)
 * covers roughly one TRC-20 transfer.
 */
export async function availableBandwidth(
  tronWeb: TronWeb,
  address: string,
): Promise<number> {
  const resources = await tronWeb.trx.getAccountResources(address);
  const free = (resources.freeNetLimit ?? 0) - (resources.freeNetUsed ?? 0);
  const staked = (resources.NetLimit ?? 0) - (resources.NetUsed ?? 0);
  return free + staked;
}
