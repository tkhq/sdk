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

export async function broadcast(
  tronWeb: TronWeb,
  signed: SignedTronTransaction,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await tronWeb.trx.sendRawTransaction(signed as any);
  if (!result.result) {
    throw new Error(`broadcast failed: ${result.message ?? result.code}`);
  }
  return result.txid ?? signed.txID;
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
    const info = (await tronWeb.trx.getTransactionInfo(txid)) as any;
    if (!info?.id) continue; // not included yet
    const receipt = info.receipt?.result;
    if (info.result === "FAILED" || (receipt && receipt !== "SUCCESS")) {
      const detail = info.resMessage
        ? Buffer.from(info.resMessage, "hex").toString()
        : "";
      throw new Error(
        `tx ${txid} failed on-chain: ${receipt ?? "FAILED"} ${detail}`,
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
