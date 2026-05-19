import * as btc from "@scure/btc-signer";

export const DEFAULT_SPARK_REGTEST_ELECTRS_URL =
  "https://regtest-mempool.us-west-2.sparkinfra.net/api";

export const REGTEST_NETWORK = { ...btc.TEST_NETWORK, bech32: "bcrt" };
export const DUST_SATS = 546n;

const DEFAULT_FUNDING_TIMEOUT_MS = 60000;
const DEFAULT_FUNDING_POLL_MS = 5000;
const DEFAULT_SPARK_REGTEST_ELECTRS_AUTH = {
  username: "spark-sdk",
  password: "mCMk1JqlBNtetUNy",
};

export type BalanceSats = number | bigint | string;

export type SparkWalletBalanceLike = {
  getBalance(): Promise<{ satsBalance?: { available?: BalanceSats } }>;
};

type ElectrsAuth = {
  username: string;
  password: string;
};

export type Utxo = {
  txid: string;
  vout: number;
  value: number;
  status?: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
};

type AddressTx = {
  txid: string;
  vin: {
    txid?: string;
    vout?: number;
  }[];
  vout: {
    value: number;
    scriptpubkey_address?: string;
  }[];
  status?: Utxo["status"];
};

export type TxStatus = {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
};

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0)
    throw new Error(`Invalid hex length: ${hex.length}`);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function balanceSatsToBigInt(value: BalanceSats | undefined): bigint {
  if (value === undefined) return 0n;
  return BigInt(value);
}

export function xOnlyPublicKey(publicKeyHex: string): Uint8Array {
  const bytes = hexToBytes(publicKeyHex);
  if (bytes.length === 32) return bytes;
  if (bytes.length === 33 && (bytes[0] === 0x02 || bytes[0] === 0x03)) {
    return bytes.slice(1);
  }
  throw new Error(
    "L1 funding public key must be a compressed or x-only secp256k1 public key",
  );
}

function electrsAuthForUrl(baseUrl: string): ElectrsAuth | undefined {
  const username = process.env.SPARK_REGTEST_ELECTRS_USER;
  const password = process.env.SPARK_REGTEST_ELECTRS_PASSWORD;
  if (username || password) {
    if (!username || !password) {
      throw new Error(
        "Set both SPARK_REGTEST_ELECTRS_USER and SPARK_REGTEST_ELECTRS_PASSWORD",
      );
    }
    return { username, password };
  }

  if (baseUrl === DEFAULT_SPARK_REGTEST_ELECTRS_URL) {
    return DEFAULT_SPARK_REGTEST_ELECTRS_AUTH;
  }

  return undefined;
}

function electrsHeaders(baseUrl: string): Headers {
  const headers = new Headers();
  const auth = electrsAuthForUrl(baseUrl);
  if (auth) {
    headers.set(
      "Authorization",
      `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}`,
    );
  }
  return headers;
}

export async function fetchElectrsJson<T>(
  baseUrl: string,
  path: string,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: electrsHeaders(baseUrl),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Electrs ${path} failed (${response.status}): ${body}`);
  }
  return JSON.parse(body) as T;
}

export async function postElectrsText(
  baseUrl: string,
  path: string,
  body: string,
): Promise<string> {
  const headers = electrsHeaders(baseUrl);
  headers.set("Content-Type", "text/plain");

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body,
  });
  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(
      `Electrs ${path} failed (${response.status}): ${responseBody}`,
    );
  }
  return responseBody.trim();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchFundingUtxos(
  baseUrl: string,
  address: string,
): Promise<Utxo[]> {
  try {
    return await fetchElectrsJson<Utxo[]>(baseUrl, `/address/${address}/utxo`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("(404)")) throw err;
  }

  // Spark's hosted regtest endpoint currently exposes address transaction
  // history but not Esplora's /address/:address/utxo route.
  let txs: AddressTx[];
  try {
    txs = await fetchElectrsJson<AddressTx[]>(
      baseUrl,
      `/address/${address}/txs`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("(404)")) return [];
    throw err;
  }
  const spent = new Set<string>();
  for (const tx of txs) {
    for (const input of tx.vin) {
      if (input.txid && input.vout !== undefined) {
        spent.add(`${input.txid}:${input.vout}`);
      }
    }
  }

  const utxos: Utxo[] = [];
  for (const tx of txs) {
    tx.vout.forEach((output, index) => {
      if (output.scriptpubkey_address !== address) return;
      if (spent.has(`${tx.txid}:${index}`)) return;
      const utxo: Utxo = {
        txid: tx.txid,
        vout: index,
        value: output.value,
      };
      if (tx.status) utxo.status = tx.status;
      utxos.push(utxo);
    });
  }

  return utxos;
}

export async function waitForFundingUtxos(params: {
  address: string;
  electrsUrl?: string | undefined;
  timeoutMs?: number | undefined;
  pollMs?: number | undefined;
  log?: ((message: string) => void) | undefined;
}): Promise<Utxo[]> {
  const baseUrl = params.electrsUrl ?? DEFAULT_SPARK_REGTEST_ELECTRS_URL;
  const timeoutMs = params.timeoutMs ?? DEFAULT_FUNDING_TIMEOUT_MS;
  const pollMs = params.pollMs ?? DEFAULT_FUNDING_POLL_MS;
  const deadline = Date.now() + timeoutMs;
  let loggedFundingPrompt = false;

  while (true) {
    const utxos = await fetchFundingUtxos(baseUrl, params.address);
    if (utxos.length > 0) return utxos;

    if (!loggedFundingPrompt) {
      params.log?.(`No spendable UTXOs found for ${params.address}.`);
      params.log?.(
        "Fund this address with the Lightspark regtest faucet, Bitcoin receiver mode:",
      );
      params.log?.("https://app.lightspark.com/regtest-faucet");
      loggedFundingPrompt = true;
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for L1 funding UTXO for ${params.address}. ` +
          "Fund the address from the Lightspark regtest faucet and rerun.",
      );
    }

    params.log?.(`Waiting for L1 funding UTXO for ${params.address}...`);
    await sleep(pollMs);
  }
}

export async function waitForConfirmation(params: {
  txid: string;
  electrsUrl?: string | undefined;
  timeoutMs?: number | undefined;
  pollMs?: number | undefined;
  log?: ((message: string) => void) | undefined;
}): Promise<TxStatus> {
  const baseUrl = params.electrsUrl ?? DEFAULT_SPARK_REGTEST_ELECTRS_URL;
  const timeoutMs = params.timeoutMs ?? 300000;
  const pollMs = params.pollMs ?? 5000;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const status = await fetchElectrsJson<TxStatus>(
      baseUrl,
      `/tx/${params.txid}/status`,
    );
    if (status.confirmed) return status;

    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for L1 deposit tx ${params.txid} to confirm. ` +
          `Set L1_DEPOSIT_TXID=${params.txid} and rerun after it confirms.`,
      );
    }

    params.log?.(`Waiting for L1 confirmation for ${params.txid}...`);
    await sleep(pollMs);
  }
}

export async function waitForSparkAvailableBalance(params: {
  wallet: SparkWalletBalanceLike;
  minBalanceSats: bigint;
  timeoutMs?: number | undefined;
  pollMs?: number | undefined;
  log?: ((message: string) => void) | undefined;
}): Promise<BalanceSats> {
  const timeoutMs = params.timeoutMs ?? 300000;
  const pollMs = params.pollMs ?? 5000;
  const deadline = Date.now() + timeoutMs;
  let lastAvailable: BalanceSats = 0;

  while (true) {
    const balance = await params.wallet.getBalance();
    lastAvailable = balance.satsBalance?.available ?? 0;
    if (balanceSatsToBigInt(lastAvailable) >= params.minBalanceSats) {
      return lastAvailable;
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for Spark balance to reach ${params.minBalanceSats} sats. ` +
          `Last available balance: ${lastAvailable} sats.`,
      );
    }

    params.log?.(
      `Waiting for Spark deposit availability. ` +
        `Need ${params.minBalanceSats} sats, currently ${lastAvailable} sats...`,
    );
    await sleep(pollMs);
  }
}
