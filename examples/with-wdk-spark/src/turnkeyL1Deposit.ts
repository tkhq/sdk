import * as btc from "@scure/btc-signer";
import type { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

export const DEFAULT_SPARK_REGTEST_ELECTRS_URL =
  "https://regtest-mempool.us-west-2.sparkinfra.net/api";

const REGTEST_NETWORK = { ...btc.TEST_NETWORK, bech32: "bcrt" };
const DUST_SATS = 546n;
const DEFAULT_FUNDING_TIMEOUT_MS = 60000;
const DEFAULT_FUNDING_POLL_MS = 5000;

type BalanceSats = number | bigint | string;

type SparkWalletDepositLike = {
  getSingleUseDepositAddress(): Promise<string>;
  claimDeposit(txid: string): Promise<unknown>;
  getBalance(): Promise<{ satsBalance?: { available?: BalanceSats } }>;
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

export interface TurnkeyL1DepositOptions {
  wallet: SparkWalletDepositLike;
  turnkeyClient: TurnkeyServerSDK;
  fundingAddress: string;
  fundingPublicKeyHex: string;
  existingTxid?: string | undefined;
  amountSats?: bigint | undefined;
  feeSats?: bigint | undefined;
  electrsUrl?: string | undefined;
  fundingTimeoutMs?: number | undefined;
  fundingPollMs?: number | undefined;
  confirmationTimeoutMs?: number | undefined;
  confirmationPollMs?: number | undefined;
  log?: ((message: string) => void) | undefined;
}

export interface TurnkeyL1DepositResult {
  txid: string;
  depositAddress?: string;
  depositSats?: bigint;
  feeSats?: bigint;
  status: TxStatus;
  balanceSats: BalanceSats;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0)
    throw new Error(`Invalid hex length: ${hex.length}`);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function xOnlyPublicKey(publicKeyHex: string): Uint8Array {
  const bytes = hexToBytes(publicKeyHex);
  if (bytes.length === 32) return bytes;
  if (bytes.length === 33 && (bytes[0] === 0x02 || bytes[0] === 0x03)) {
    return bytes.slice(1);
  }
  throw new Error(
    "L1 funding public key must be a compressed or x-only secp256k1 public key",
  );
}

async function fetchElectrsJson<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Electrs ${path} failed (${response.status}): ${body}`);
  }
  return JSON.parse(body) as T;
}

async function postElectrsText(
  baseUrl: string,
  path: string,
  body: string,
): Promise<string> {
  const headers = new Headers();
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

function sleep(ms: number): Promise<void> {
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

async function claimDeposit(wallet: SparkWalletDepositLike, txid: string) {
  try {
    await wallet.claimDeposit(txid);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Deposit address has already been used")) {
      return;
    }
    throw err;
  }
}

export async function depositTurnkeyL1ToSpark(
  options: TurnkeyL1DepositOptions,
): Promise<TurnkeyL1DepositResult> {
  const log = options.log ?? (() => undefined);
  const electrsUrl = options.electrsUrl ?? DEFAULT_SPARK_REGTEST_ELECTRS_URL;
  const fundingPublicKey = xOnlyPublicKey(options.fundingPublicKeyHex);
  const fundingPayment = btc.p2tr(fundingPublicKey, undefined, REGTEST_NETWORK);
  if (fundingPayment.address !== options.fundingAddress) {
    throw new Error(
      `L1 funding public key does not derive the funding address. ` +
        `Expected ${fundingPayment.address}, got ${options.fundingAddress}`,
    );
  }

  if (options.existingTxid) {
    log(`Using existing L1 deposit txid: ${options.existingTxid}`);
    const status = await waitForConfirmation({
      txid: options.existingTxid,
      electrsUrl,
      timeoutMs: options.confirmationTimeoutMs,
      pollMs: options.confirmationPollMs,
      log,
    });

    await claimDeposit(options.wallet, options.existingTxid);
    const balance = await options.wallet.getBalance();
    return {
      txid: options.existingTxid,
      status,
      balanceSats: balance.satsBalance?.available ?? 0,
    };
  }

  const depositAddress = await options.wallet.getSingleUseDepositAddress();
  log(`Spark L1 deposit address: ${depositAddress}`);

  const utxos = await waitForFundingUtxos({
    address: options.fundingAddress,
    electrsUrl,
    timeoutMs: options.fundingTimeoutMs,
    pollMs: options.fundingPollMs,
    log,
  });

  const totalSats = utxos.reduce((sum, utxo) => sum + BigInt(utxo.value), 0n);
  const feeSats = options.feeSats ?? 500n;
  const depositSats = options.amountSats ?? totalSats - feeSats;
  const changeSats = totalSats - depositSats - feeSats;

  if (depositSats <= 0n || changeSats < 0n) {
    throw new Error(
      `Insufficient funds. Available=${totalSats}, requested=${depositSats}, fee=${feeSats}`,
    );
  }

  const tx = new btc.Transaction({ allowUnknownOutputs: true });
  for (const utxo of utxos) {
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        amount: BigInt(utxo.value),
        script: fundingPayment.script,
      },
      tapInternalKey: fundingPublicKey,
    });
  }
  tx.addOutputAddress(depositAddress, depositSats, REGTEST_NETWORK);
  if (changeSats >= DUST_SATS) {
    tx.addOutputAddress(options.fundingAddress, changeSats, REGTEST_NETWORK);
  }

  const actualFeeSats =
    feeSats + (changeSats > 0n && changeSats < DUST_SATS ? changeSats : 0n);
  if (changeSats > 0n && changeSats < DUST_SATS) {
    log(`Adding ${changeSats} sats below dust threshold to miner fee`);
  }
  log(
    `Signing L1 deposit transaction: ${depositSats} sats to Spark, ${actualFeeSats} sats fee`,
  );

  const signed = await options.turnkeyClient.apiClient().signTransaction({
    signWith: options.fundingAddress,
    unsignedTransaction: bytesToHex(tx.toPSBT()),
    type: "TRANSACTION_TYPE_BITCOIN",
  });

  const signedTx = btc.Transaction.fromPSBT(
    hexToBytes(signed.signedTransaction),
    {
      allowUnknownOutputs: true,
    },
  );
  signedTx.finalize();

  const txid = await postElectrsText(electrsUrl, "/tx", signedTx.hex);
  log(`Broadcast L1 txid: ${txid}`);
  log(
    `Set L1_DEPOSIT_TXID=${txid} to retry claiming without spending another UTXO.`,
  );

  const status = await waitForConfirmation({
    txid,
    electrsUrl,
    timeoutMs: options.confirmationTimeoutMs,
    pollMs: options.confirmationPollMs,
    log,
  });

  await claimDeposit(options.wallet, txid);
  const balance = await options.wallet.getBalance();
  return {
    txid,
    depositAddress,
    depositSats,
    feeSats: actualFeeSats,
    status,
    balanceSats: balance.satsBalance?.available ?? 0,
  };
}
