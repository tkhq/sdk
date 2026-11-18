import { Turnkey } from "@turnkey/sdk-server";
import { TronWeb } from "tronweb";

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
  // TronGrid throttles anonymous mainnet traffic; set TRONGRID_API_KEY.
  const apiKey = process.env.TRONGRID_API_KEY;
  return new TronWeb({
    fullHost: process.env.TRON_FULL_HOST ?? "https://api.trongrid.io",
    ...(apiKey ? { headers: { "TRON-PRO-API-KEY": apiKey } } : {}),
  });
}

export function explorerTxUrl(txid: string): string {
  const host = process.env.TRON_FULL_HOST ?? "";
  const base = host.includes("nile")
    ? "https://nile.tronscan.org"
    : "https://tronscan.org";
  return `${base}/#/transaction/${txid}`;
}

/**
 * Energy expressed as the staked TRX (in SUN) that currently yields it.
 * Delegations are denominated in stake, not energy, and the ratio floats with
 * network-wide stake — so read it live rather than hardcoding it.
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
  // Tron's signing digest is sha256(raw_data).
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
    throw new Error(
      `broadcast failed: ${decodeNodeMessage(result.message) || result.code}`,
    );
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

/** A transaction can be included and still fail on-chain (e.g. OUT_OF_ENERGY). */
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
      continue; // transient node error; a caller may be holding a rental open
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

/** Spendable energy: own stake plus delegations, net of usage. */
export async function availableEnergy(
  tronWeb: TronWeb,
  address: string,
): Promise<number> {
  const resources = await tronWeb.trx.getAccountResources(address);
  return (resources.EnergyLimit ?? 0) - (resources.EnergyUsed ?? 0);
}

/**
 * Spendable bandwidth. Energy providers delegate energy only; bandwidth is a
 * separate resource whose free allowance (600/day) covers about one transfer.
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
