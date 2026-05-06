import * as btc from "@scure/btc-signer";
import type { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import {
  DEFAULT_SPARK_REGTEST_ELECTRS_URL,
  DUST_SATS,
  REGTEST_NETWORK,
  balanceSatsToBigInt,
  bytesToHex,
  hexToBytes,
  postElectrsText,
  waitForConfirmation,
  waitForFundingUtxos,
  waitForSparkAvailableBalance,
  xOnlyPublicKey,
  type BalanceSats,
  type SparkWalletBalanceLike,
  type TxStatus,
} from "./common";

export type SparkWalletDepositLike = SparkWalletBalanceLike & {
  getSingleUseDepositAddress(): Promise<string>;
  advancedDeposit(txHex: string): Promise<unknown>;
  claimDeposit(txid: string): Promise<unknown>;
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
    // Retry path for an already-broadcast L1 tx. The pre-broadcast advancedDeposit
    // window is closed: the refund tree must be signed via claimDeposit post-confirm,
    // which trusts operators not to refuse. This is asymmetric with the happy path
    // below — and intentional, because there's no way to recover the pre-broadcast
    // invariant once the deposit is on-chain.
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

  const balanceBefore = await options.wallet.getBalance();
  const minBalanceSats =
    balanceSatsToBigInt(balanceBefore.satsBalance?.available) + depositSats;

  log(
    "Preparing Spark deposit tree and refund transactions before L1 broadcast",
  );
  await options.wallet.advancedDeposit(tx.hex);

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

  // Surface the signed tx before broadcast. advancedDeposit has already consumed
  // the deposit address upstream, so a broadcast failure here strands the leaf
  // tree until this exact hex reaches the network. Logging the hex + txid lets
  // the user recover by rebroadcasting via any Bitcoin node, then re-running
  // with L1_DEPOSIT_TXID to pick up from the confirmation step.
  const signedTxid = signedTx.id;
  log(
    `Signed L1 deposit ready (txid ${signedTxid}). If broadcast fails, ` +
      `rebroadcast the hex below via any Bitcoin node and rerun with ` +
      `L1_DEPOSIT_TXID=${signedTxid}:`,
  );
  log(signedTx.hex);

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

  const availableBalance = await waitForSparkAvailableBalance({
    wallet: options.wallet,
    minBalanceSats,
    timeoutMs: options.confirmationTimeoutMs,
    pollMs: options.confirmationPollMs,
    log,
  });
  return {
    txid,
    depositAddress,
    depositSats,
    feeSats: actualFeeSats,
    status,
    balanceSats: availableBalance,
  };
}
