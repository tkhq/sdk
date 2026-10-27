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
  return new TronWeb({
    fullHost: "https://nile.trongrid.io/", // Testnet
  });
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
      throw new Error(`tx ${txid} failed on-chain: ${receipt ?? "FAILED"} ${detail}`);
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
