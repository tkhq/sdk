import * as btc from "@scure/btc-signer";
import { secp256k1 } from "@noble/curves/secp256k1";
import { Crypto } from "@peculiar/webcrypto";
import { decryptExportBundle, generateP256KeyPair } from "@turnkey/crypto";
import type { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import type { TurnkeySparkSigner } from "../turnkeySigner";
import {
  DEFAULT_SPARK_REGTEST_ELECTRS_URL,
  DUST_SATS,
  REGTEST_NETWORK,
  balanceSatsToBigInt,
  bytesToHex,
  fetchElectrsJson,
  hexToBytes,
  postElectrsText,
  waitForConfirmation,
  waitForFundingUtxos,
  waitForSparkAvailableBalance,
  xOnlyPublicKey,
  type BalanceSats,
  type TxStatus,
} from "./common";

if (typeof globalThis.crypto === "undefined") {
  (globalThis as unknown as { crypto: Crypto }).crypto = new Crypto();
}

const STATIC_DEPOSIT_ADDRESS_FORMAT = "ADDRESS_FORMAT_COMPRESSED";
const TURNKEY_PRODUCTION_BASE_URL = "https://api.turnkey.com";

// Source of truth: packages/crypto/src/constants.ts PRODUCTION_SIGNER_SIGN_PUBLIC_KEY.
const TURNKEY_PRODUCTION_EXPORT_SIGNER_PUBLIC_KEY =
  "04cf288fe433cc4e1aa0ce1632feac4ea26bf2f5a09dcfe5a42c398e06898710330f0572882f4dbdf0f5304b8fc8703acd69adca9a4bbf7f5d00d20a5e364b2569";

type ApiClient = ReturnType<TurnkeyServerSDK["apiClient"]> & {
  config: { organizationId?: string };
};

type WalletAccount = {
  walletId?: string;
  address: string;
  addressFormat: string;
  path: string;
  publicKey?: string;
};

type WalletListItem = {
  walletId: string;
};

type StaticDepositQuote = {
  creditAmountSats: number;
  feeSats?: number;
  signature: string;
};

type StaticDepositClaimRequest = {
  transactionId: string;
  creditAmountSats: number;
  sspSignature: string;
  outputIndex?: number;
};

type ElectrsTx = {
  vout: {
    value: number;
    scriptpubkey_address?: string;
  }[];
};

type SparkWalletStaticDepositLike = {
  getStaticDepositAddress(): Promise<string>;
  getClaimStaticDepositQuote(
    transactionId: string,
    outputIndex?: number,
  ): Promise<StaticDepositQuote>;
  claimStaticDeposit(params: StaticDepositClaimRequest): Promise<unknown>;
  getBalance(): Promise<{ satsBalance?: { available?: BalanceSats } }>;
};

export interface TurnkeyStaticDepositAccount {
  walletId: string;
  address: string;
  path: string;
  publicKeyHex: string;
  index: number;
}

export interface StaticDepositAccountOptions {
  turnkeyClient: TurnkeyServerSDK;
  sparkAddress: string;
  walletId?: string | undefined;
  staticDepositIndex?: number | undefined;
  log?: ((message: string) => void) | undefined;
}

export interface TurnkeyStaticDepositOptions {
  wallet: SparkWalletStaticDepositLike;
  turnkeyClient: TurnkeyServerSDK;
  turnkeyApiBaseUrl: string;
  fundingAddress: string;
  fundingPublicKeyHex: string;
  existingTxid?: string | undefined;
  existingOutputIndex?: number | undefined;
  amountSats?: bigint | undefined;
  feeSats?: bigint | undefined;
  maxClaimFeeSats?: bigint | undefined;
  electrsUrl?: string | undefined;
  fundingTimeoutMs?: number | undefined;
  fundingPollMs?: number | undefined;
  confirmationTimeoutMs?: number | undefined;
  confirmationPollMs?: number | undefined;
  signer: TurnkeySparkSigner;
  staticDepositAccountAddress: string;
  staticDepositAccountPublicKeyHex: string;
  staticDepositIndex?: number | undefined;
  log?: ((message: string) => void) | undefined;
}

export interface TurnkeyStaticDepositResult {
  txid: string;
  status: TxStatus;
  quoteCreditAmountSats: number;
  balanceSats: BalanceSats;
  depositAddress?: string | undefined;
  outputIndex?: number | undefined;
  depositSats?: bigint | undefined;
  feeSats?: bigint | undefined;
  quoteFeeSats?: number | undefined;
}

function getApiClient(turnkeyClient: TurnkeyServerSDK): ApiClient {
  return turnkeyClient.apiClient() as ApiClient;
}

function getOrganizationId(apiClient: ApiClient): string {
  const organizationId = apiClient.config.organizationId;
  if (!organizationId) {
    throw new Error("Turnkey client is missing defaultOrganizationId");
  }
  return organizationId;
}

function normalizeTurnkeyBaseUrl(baseUrl: string): string {
  return new URL(baseUrl).origin;
}

function assertExportSignerPublicKey(publicKey: string): string {
  const trimmedPublicKey = publicKey.trim();
  if (!/^04[0-9a-fA-F]{128}$/.test(trimmedPublicKey)) {
    throw new Error(
      "TURNKEY_EXPORT_SIGNER_PUBLIC_KEY must be a 65-byte uncompressed " +
        "public key hex string",
    );
  }
  return trimmedPublicKey;
}

function exportSignerPublicKeyForBaseUrl(apiBaseUrl: string): string {
  if (normalizeTurnkeyBaseUrl(apiBaseUrl) === TURNKEY_PRODUCTION_BASE_URL) {
    return assertExportSignerPublicKey(
      TURNKEY_PRODUCTION_EXPORT_SIGNER_PUBLIC_KEY,
    );
  }

  const override = process.env.TURNKEY_EXPORT_SIGNER_PUBLIC_KEY?.trim();
  if (override) {
    return assertExportSignerPublicKey(override);
  }

  throw new Error(
    "TURNKEY_EXPORT_SIGNER_PUBLIC_KEY is required for static deposit key " +
      `export when BASE_URL is ${apiBaseUrl}`,
  );
}

function parsePrivateKeyHex(value: string): Uint8Array {
  const hex = value.trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "Exported static deposit key was not a 32-byte hex private key",
    );
  }
  return Buffer.from(hex, "hex");
}

function normalizeSecp256k1PublicKeyHex(publicKeyHex: string): string {
  const hex = publicKeyHex.trim().replace(/^0x/, "");
  try {
    return bytesToHex(
      secp256k1.ProjectivePoint.fromHex(hexToBytes(hex)).toRawBytes(true),
    );
  } catch {
    throw new Error(`Invalid secp256k1 public key: ${publicKeyHex}`);
  }
}

async function assertStaticDepositAccountMatchesSpark(params: {
  signer: TurnkeySparkSigner;
  staticDepositIndex: number;
  staticDepositAccountPublicKeyHex: string;
}) {
  const sparkPublicKey = await params.signer.getStaticDepositSigningKey(
    params.staticDepositIndex,
  );
  const expectedPublicKeyHex = normalizeSecp256k1PublicKeyHex(
    bytesToHex(sparkPublicKey),
  );
  const actualPublicKeyHex = normalizeSecp256k1PublicKeyHex(
    params.staticDepositAccountPublicKeyHex,
  );

  if (actualPublicKeyHex !== expectedPublicKeyHex) {
    throw new Error(
      `Turnkey static deposit account public key ${actualPublicKeyHex} ` +
        `does not match Spark-derived public key ${expectedPublicKeyHex}`,
    );
  }
}

export function staticDepositPathFromIdentityPath(
  identityPath: string,
  staticDepositIndex: number,
): string {
  if (!Number.isInteger(staticDepositIndex) || staticDepositIndex < 0) {
    throw new Error(`Invalid static deposit index: ${staticDepositIndex}`);
  }

  const identitySuffix = "/0'";
  if (!identityPath.endsWith(identitySuffix)) {
    throw new Error(
      `Spark identity account path must end in ${identitySuffix}, got ${identityPath}`,
    );
  }

  return `${identityPath.slice(0, -identitySuffix.length)}/3'/${staticDepositIndex}'`;
}

async function getWalletAccounts(
  apiClient: ApiClient,
  walletId: string,
): Promise<WalletAccount[]> {
  const { accounts } = await apiClient.getWalletAccounts({
    organizationId: getOrganizationId(apiClient),
    walletId,
  });
  return accounts as WalletAccount[];
}

async function findSparkAccount(params: {
  apiClient: ApiClient;
  sparkAddress: string;
  walletId?: string | undefined;
}): Promise<{ walletId: string; account: WalletAccount }> {
  if (params.walletId) {
    const accounts = await getWalletAccounts(params.apiClient, params.walletId);
    const account = accounts.find(
      (candidate) => candidate.address === params.sparkAddress,
    );
    if (!account) {
      throw new Error(
        `Could not find TURNKEY_SPARK_ADDRESS=${params.sparkAddress} in wallet ${params.walletId}`,
      );
    }
    return { walletId: params.walletId, account };
  }

  const { wallets } = await params.apiClient.getWallets({
    organizationId: getOrganizationId(params.apiClient),
  });

  for (const wallet of wallets as WalletListItem[]) {
    const accounts = await getWalletAccounts(params.apiClient, wallet.walletId);
    const account = accounts.find(
      (candidate) => candidate.address === params.sparkAddress,
    );
    if (account) {
      return { walletId: wallet.walletId, account };
    }
  }

  throw new Error(
    `Could not find a Turnkey wallet containing TURNKEY_SPARK_ADDRESS=${params.sparkAddress}`,
  );
}

export async function createOrReuseStaticDepositAccount(
  options: StaticDepositAccountOptions,
): Promise<TurnkeyStaticDepositAccount> {
  const log = options.log ?? (() => undefined);
  const apiClient = getApiClient(options.turnkeyClient);
  const index = options.staticDepositIndex ?? 0;
  const sparkAccount = await findSparkAccount({
    apiClient,
    sparkAddress: options.sparkAddress,
    walletId: options.walletId,
  });
  const staticPath = staticDepositPathFromIdentityPath(
    sparkAccount.account.path,
    index,
  );

  let accounts = await getWalletAccounts(apiClient, sparkAccount.walletId);
  let account = accounts.find(
    (candidate) =>
      candidate.path === staticPath &&
      candidate.addressFormat === STATIC_DEPOSIT_ADDRESS_FORMAT,
  );

  if (!account) {
    log(`Creating static deposit wallet account at ${staticPath}`);
    const result = await apiClient.createWalletAccounts({
      organizationId: getOrganizationId(apiClient),
      walletId: sparkAccount.walletId,
      accounts: [
        {
          curve: "CURVE_SECP256K1",
          pathFormat: "PATH_FORMAT_BIP32",
          path: staticPath,
          addressFormat: STATIC_DEPOSIT_ADDRESS_FORMAT,
        },
      ],
    });

    const address = result.addresses[0];
    if (!address) {
      throw new Error(
        "Turnkey did not return an address for the static deposit account",
      );
    }

    accounts = await getWalletAccounts(apiClient, sparkAccount.walletId);
    account = accounts.find((candidate) => candidate.address === address);
  } else {
    log(`Reusing static deposit wallet account at ${staticPath}`);
  }

  if (!account?.publicKey) {
    throw new Error("Could not load static deposit account public key");
  }

  return {
    walletId: sparkAccount.walletId,
    address: account.address,
    path: account.path,
    publicKeyHex: account.publicKey,
    index,
  };
}

export async function exportStaticDepositSecretKey(params: {
  turnkeyClient: TurnkeyServerSDK;
  accountAddress: string;
  apiBaseUrl: string;
}): Promise<Uint8Array> {
  const apiClient = getApiClient(params.turnkeyClient);
  const keyPair = generateP256KeyPair();

  const exportResult = await apiClient.exportWalletAccount({
    address: params.accountAddress,
    targetPublicKey: keyPair.publicKeyUncompressed,
  });
  const signerPublicKey = exportSignerPublicKeyForBaseUrl(params.apiBaseUrl);

  const decryptedBundle = await decryptExportBundle({
    exportBundle: exportResult.exportBundle,
    embeddedKey: keyPair.privateKey,
    organizationId: getOrganizationId(apiClient),
    dangerouslyOverrideSignerPublicKey: signerPublicKey,
    returnMnemonic: false,
  });

  return parsePrivateKeyHex(decryptedBundle);
}

export async function installStaticDepositSecretKey(params: {
  turnkeyClient: TurnkeyServerSDK;
  signer: TurnkeySparkSigner;
  accountAddress: string;
  apiBaseUrl: string;
  index: number;
}): Promise<void> {
  const secretKey = await exportStaticDepositSecretKey({
    turnkeyClient: params.turnkeyClient,
    accountAddress: params.accountAddress,
    apiBaseUrl: params.apiBaseUrl,
  });

  try {
    await params.signer.setStaticDepositSecretKey(params.index, secretKey);
  } finally {
    secretKey.fill(0);
  }
}

function txOutputAddress(tx: btc.Transaction, index: number): string {
  const output = tx.getOutput(index);
  if (!output?.script) {
    throw new Error(`Signed transaction is missing output ${index}`);
  }

  return btc
    .Address(REGTEST_NETWORK)
    .encode(btc.OutScript.decode(output.script));
}

function assertStaticDepositOutput(params: {
  tx: btc.Transaction;
  outputIndex: number;
  depositAddress: string;
  depositSats: bigint;
}) {
  const output = params.tx.getOutput(params.outputIndex);
  if (!output) {
    throw new Error(
      `Signed transaction is missing output ${params.outputIndex}`,
    );
  }

  const actualAddress = txOutputAddress(params.tx, params.outputIndex);
  if (actualAddress !== params.depositAddress) {
    throw new Error(
      `Signed transaction output ${params.outputIndex} pays ${actualAddress}, ` +
        `expected static deposit address ${params.depositAddress}`,
    );
  }

  if (output.amount !== params.depositSats) {
    throw new Error(
      `Signed transaction output ${params.outputIndex} pays ${output.amount} sats, ` +
        `expected ${params.depositSats} sats`,
    );
  }
}

async function fetchTxOutputValueSats(params: {
  electrsUrl: string;
  txid: string;
  outputIndex: number;
  expectedAddress?: string | undefined;
}): Promise<bigint> {
  const tx = await fetchElectrsJson<ElectrsTx>(
    params.electrsUrl,
    `/tx/${params.txid}`,
  );
  const output = tx.vout[params.outputIndex];
  if (!output) {
    throw new Error(
      `Transaction ${params.txid} is missing output ${params.outputIndex}`,
    );
  }
  if (
    params.expectedAddress !== undefined &&
    output.scriptpubkey_address !== params.expectedAddress
  ) {
    throw new Error(
      `Transaction ${params.txid} output ${params.outputIndex} pays ` +
        `${output.scriptpubkey_address ?? "unknown address"}, expected ` +
        `static deposit address ${params.expectedAddress}`,
    );
  }
  return BigInt(output.value);
}

function assertClaimFeeWithinLimit(params: {
  depositAmountSats: bigint;
  creditAmountSats: number;
  maxClaimFeeSats: bigint;
}) {
  if (params.creditAmountSats <= 0) {
    throw new Error(
      `Static deposit quote has non-positive credit: ${params.creditAmountSats}`,
    );
  }

  const creditAmountSats = BigInt(params.creditAmountSats);
  if (creditAmountSats > params.depositAmountSats) {
    throw new Error(
      `Static deposit quote credits ${creditAmountSats} sats, ` +
        `which exceeds deposit output ${params.depositAmountSats} sats`,
    );
  }

  const claimFeeSats = params.depositAmountSats - creditAmountSats;
  if (claimFeeSats > params.maxClaimFeeSats) {
    throw new Error(
      `Static deposit quote fee ${claimFeeSats} sats exceeds max ` +
        `${params.maxClaimFeeSats} sats`,
    );
  }
}

export async function depositTurnkeyL1ToStaticSpark(
  options: TurnkeyStaticDepositOptions,
): Promise<TurnkeyStaticDepositResult> {
  const log = options.log ?? (() => undefined);
  const electrsUrl = options.electrsUrl ?? DEFAULT_SPARK_REGTEST_ELECTRS_URL;
  const staticDepositIndex = options.staticDepositIndex ?? 0;
  if (staticDepositIndex !== 0) {
    throw new Error(
      "STATIC_DEPOSIT_INDEX must be 0 because the current Spark SDK static " +
        "deposit claim path hardcodes getStaticDepositSecretKey(0)",
    );
  }
  await assertStaticDepositAccountMatchesSpark({
    signer: options.signer,
    staticDepositIndex,
    staticDepositAccountPublicKeyHex: options.staticDepositAccountPublicKeyHex,
  });

  const balanceBefore = await options.wallet.getBalance();
  const minBalanceBase = balanceSatsToBigInt(
    balanceBefore.satsBalance?.available,
  );

  let txid = options.existingTxid;
  let outputIndex = options.existingOutputIndex;
  let depositAddress: string | undefined;
  let depositSats: bigint | undefined;
  let feeSats: bigint | undefined;
  let depositOutputSats: bigint | undefined;
  let status: TxStatus;

  if (txid) {
    if (outputIndex === undefined) {
      throw new Error(
        "STATIC_DEPOSIT_VOUT is required when STATIC_DEPOSIT_TXID is set",
      );
    }
    log(`Using existing static deposit txid: ${txid}`);
    status = await waitForConfirmation({
      txid,
      electrsUrl,
      timeoutMs: options.confirmationTimeoutMs,
      pollMs: options.confirmationPollMs,
      log,
    });
    depositAddress = await options.wallet.getStaticDepositAddress();
    depositOutputSats = await fetchTxOutputValueSats({
      electrsUrl,
      txid,
      outputIndex,
      expectedAddress: depositAddress,
    });
  } else {
    const fundingPublicKey = xOnlyPublicKey(options.fundingPublicKeyHex);
    const fundingPayment = btc.p2tr(
      fundingPublicKey,
      undefined,
      REGTEST_NETWORK,
    );
    if (fundingPayment.address !== options.fundingAddress) {
      throw new Error(
        `L1 funding public key does not derive the funding address. ` +
          `Expected ${fundingPayment.address}, got ${options.fundingAddress}`,
      );
    }

    depositAddress = await options.wallet.getStaticDepositAddress();
    log(`Spark static deposit address: ${depositAddress}`);

    const utxos = await waitForFundingUtxos({
      address: options.fundingAddress,
      electrsUrl,
      timeoutMs: options.fundingTimeoutMs,
      pollMs: options.fundingPollMs,
      log,
    });

    const totalSats = utxos.reduce((sum, utxo) => sum + BigInt(utxo.value), 0n);
    const requestedFeeSats = options.feeSats ?? 500n;
    depositSats = options.amountSats ?? totalSats - requestedFeeSats;
    const changeSats = totalSats - depositSats - requestedFeeSats;

    if (depositSats <= 0n || changeSats < 0n) {
      throw new Error(
        `Insufficient funds. Available=${totalSats}, requested=${depositSats}, fee=${requestedFeeSats}`,
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

    outputIndex = 0;
    tx.addOutputAddress(depositAddress, depositSats, REGTEST_NETWORK);
    if (changeSats >= DUST_SATS) {
      tx.addOutputAddress(options.fundingAddress, changeSats, REGTEST_NETWORK);
    }

    feeSats =
      requestedFeeSats +
      (changeSats > 0n && changeSats < DUST_SATS ? changeSats : 0n);
    if (changeSats > 0n && changeSats < DUST_SATS) {
      log(`Adding ${changeSats} sats below dust threshold to miner fee`);
    }

    log(
      `Signing static deposit funding transaction: ${depositSats} sats, ${feeSats} sats fee`,
    );
    const signed = await options.turnkeyClient.apiClient().signTransaction({
      signWith: options.fundingAddress,
      unsignedTransaction: bytesToHex(tx.toPSBT()),
      type: "TRANSACTION_TYPE_BITCOIN",
    });

    const signedTx = btc.Transaction.fromPSBT(
      hexToBytes(signed.signedTransaction),
      { allowUnknownOutputs: true },
    );
    signedTx.finalize();

    txid = signedTx.id;
    assertStaticDepositOutput({
      tx: signedTx,
      outputIndex,
      depositAddress,
      depositSats,
    });
    log(
      `Signed static deposit tx ready (txid ${txid}). If broadcast fails, ` +
        `rebroadcast the hex below and rerun with STATIC_DEPOSIT_TXID=${txid} ` +
        `STATIC_DEPOSIT_VOUT=${outputIndex}:`,
    );
    log(signedTx.hex);

    const broadcastTxid = await postElectrsText(
      electrsUrl,
      "/tx",
      signedTx.hex,
    );
    if (broadcastTxid !== txid) {
      throw new Error(
        `Electrs returned txid ${broadcastTxid}, expected signed txid ${txid}`,
      );
    }
    log(`Broadcast static deposit txid: ${txid}`);
    log(
      `Set STATIC_DEPOSIT_TXID=${txid} STATIC_DEPOSIT_VOUT=${outputIndex} ` +
        "to retry claiming without spending another UTXO.",
    );

    status = await waitForConfirmation({
      txid,
      electrsUrl,
      timeoutMs: options.confirmationTimeoutMs,
      pollMs: options.confirmationPollMs,
      log,
    });
  }

  const quote = await options.wallet.getClaimStaticDepositQuote(
    txid,
    outputIndex,
  );
  log(
    `Static deposit quote: ${quote.creditAmountSats} sats credit` +
      (quote.feeSats !== undefined ? `, ${quote.feeSats} sats fee` : ""),
  );

  depositOutputSats =
    depositSats ??
    depositOutputSats ??
    (await fetchTxOutputValueSats({
      electrsUrl,
      txid,
      outputIndex: outputIndex!,
      expectedAddress: depositAddress,
    }));
  assertClaimFeeWithinLimit({
    depositAmountSats: depositOutputSats,
    creditAmountSats: quote.creditAmountSats,
    maxClaimFeeSats: options.maxClaimFeeSats ?? 500n,
  });

  const claimRequest: StaticDepositClaimRequest = {
    transactionId: txid,
    creditAmountSats: quote.creditAmountSats,
    sspSignature: quote.signature,
  };
  if (outputIndex !== undefined) {
    claimRequest.outputIndex = outputIndex;
  }

  log("Exporting static deposit key for claim");
  await installStaticDepositSecretKey({
    turnkeyClient: options.turnkeyClient,
    signer: options.signer,
    accountAddress: options.staticDepositAccountAddress,
    apiBaseUrl: options.turnkeyApiBaseUrl,
    index: staticDepositIndex,
  });
  try {
    await options.wallet.claimStaticDeposit(claimRequest);
  } finally {
    options.signer.clearStaticDepositSecretKey(staticDepositIndex);
  }

  const availableBalance = await waitForSparkAvailableBalance({
    wallet: options.wallet,
    minBalanceSats: minBalanceBase + BigInt(quote.creditAmountSats),
    timeoutMs: options.confirmationTimeoutMs,
    pollMs: options.confirmationPollMs,
    log,
  });

  return {
    txid,
    status,
    quoteCreditAmountSats: quote.creditAmountSats,
    balanceSats: availableBalance,
    depositAddress,
    outputIndex,
    depositSats,
    feeSats,
    quoteFeeSats: quote.feeSats,
  };
}
