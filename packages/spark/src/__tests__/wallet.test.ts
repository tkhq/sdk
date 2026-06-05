import {
  Turnkey,
  TurnkeyApiClient,
  v1WalletAccount,
} from "@turnkey/sdk-server";
import { SparkWalletEvent } from "@buildonspark/spark-sdk";

import assert from "node:assert";
import { Curve } from "@turnkey/core";
import { SPARK_DEPOSIT_SUFFIX, SPARK_IDENTITY_SUFFIX } from "../constants";
import { TurnkeySparkSigner } from "../signer";
import { TurnkeySparkWallet } from "../wallet";

const NETWORK = "REGTEST";

const SPARK_PURPOSE = "/8797555'";
const SPARK_ACCOUNT = "/0'";
const SPARK_IDENTITY_PATH = `m${SPARK_PURPOSE}${SPARK_ACCOUNT}${SPARK_IDENTITY_SUFFIX}`;
const SPARK_DEPOSIT_PATH = `m${SPARK_PURPOSE}${SPARK_ACCOUNT}${SPARK_DEPOSIT_SUFFIX}`;
const BTC_PATH = "m/86'/1'/0'/0/0";

const SENDER_WALLET_NAME = "Spark E2E Sender";
const RECEIVER_WALLET_NAME = "Spark E2E Receiver";

const SATS_REQUIRED_FOR_TESTS = 1000;

const DEFAULT_SPARK_REGTEST_ELECTRS_URL =
  "https://regtest-mempool.us-west-2.sparkinfra.net/api";

describe("TurnkeySparkWallet", () => {
  let turnkey: Turnkey;
  let client: TurnkeyApiClient;

  let receiverAccounts: WalletAccounts;
  let senderAccounts: WalletAccounts;

  let senderSigner: TurnkeySparkSigner;
  let receiverSigner: TurnkeySparkSigner;

  let senderWallet: TurnkeySparkWallet;
  let receiverWallet: TurnkeySparkWallet;

  beforeAll(async () => {
    assert(
      typeof process.env.API_PRIVATE_KEY === "string",
      "Missing required env var: API_PRIVATE_KEY",
    );
    assert(
      typeof process.env.API_PUBLIC_KEY === "string",
      "Missing required env var: API_PUBLIC_KEY",
    );
    assert(
      typeof process.env.ORGANIZATION_ID === "string",
      "Missing required env var: ORGANIZATION_ID",
    );

    const apiBaseUrl = process.env.API_BASE_URL || "https://api.turnkey.com";
    const apiPrivateKey = process.env.API_PRIVATE_KEY;
    const apiPublicKey = process.env.API_PUBLIC_KEY;
    const organizationId = process.env.ORGANIZATION_ID;

    turnkey = new Turnkey({
      apiBaseUrl,
      apiPrivateKey,
      apiPublicKey,
      defaultOrganizationId: organizationId,
    });
    client = turnkey.apiClient();

    const getWalletIdByName = createGetWalletIdByName(client);
    const createWallet = createWalletFactory(client);
    const getWalletAccounts = createGetWalletAccounts(client);
    const createSparkSigner = createSparkSignerFactory(turnkey);

    const senderWalletId =
      (await getWalletIdByName(SENDER_WALLET_NAME)) ??
      (await createWallet(SENDER_WALLET_NAME));
    const receiverWalletId =
      (await getWalletIdByName(RECEIVER_WALLET_NAME)) ??
      (await createWallet(RECEIVER_WALLET_NAME));

    senderAccounts = await getWalletAccounts(senderWalletId);
    receiverAccounts = await getWalletAccounts(receiverWalletId);

    senderSigner = await createSparkSigner(senderAccounts);
    senderWallet = await createSparkWallet(senderSigner);

    receiverSigner = await createSparkSigner(receiverAccounts);
    receiverWallet = await createSparkWallet(receiverSigner);

    // const sparkClient = SparkReadonlyClient.createWithSigner({
    //     network: NETWORK,
    //     electrsUrl: DEFAULT_SPARK_REGTEST_ELECTRS_URL,
    // }, senderSigner)

    // const txId = "a4b3b389a95053c83786ea51d0f1285c7d2207e6c3e006859314e14d3b3c9a7e"
    // const txId = "23c6755668ac34de0adb80bda653de5eb0f31dac546a4b14a315a7711927fc09"
    // const txId = "ac5fdd3ca9cc40ea6e6e3a8fc3752171e9d770e406b6ad47cb77b328901923fe"
    // const txId = "66e21c39acd22e41ef0c2727f0578f393c9a9a734983f8e6ea83446ca0dd8c76"
    // await senderWallet.claimDeposit(txId)

    // Check that we got enough balance to run the tests
    const { satsBalance } = await senderWallet.getBalance();
    try {
      expect(satsBalance.available).toBeGreaterThanOrEqual(
        SATS_REQUIRED_FOR_TESTS,
      );
    } catch (error: unknown) {
      const depositAddress = await senderWallet.getSingleUseDepositAddress();

      throw new Error(
        `Sender wallet has insufficient balance for tests (${satsBalance.available} available, ${satsBalance.incoming} incoming). Please fund the wallet with at least ${SATS_REQUIRED_FOR_TESTS} sats on regtest.

You can use the regtest faucet at https://app.lightspark.com/regtest-faucet 
to send 100000 sats to ${depositAddress} and claim the deposit by its transaction ID:

await senderWallet.claimDeposit(txId)

Original error: ${error}`,
      );
    }
  }, 60_000);

  afterAll(async () => {
    await senderWallet.cleanup();
    await receiverWallet.cleanup();
  });

  it("should be able to transfer", async () => {
    const receiverSparkAddress = await receiverWallet.getSparkAddress();

    let resolve: () => void;
    const promise = new Promise<void>((res) => (resolve = res));

    receiverWallet.on(SparkWalletEvent.TransferClaimed, (transferId) => {
      if (transferId === transfer.id) {
        resolve();
      }
    });

    const transfer = await senderWallet.transfer({
      amountSats: 100,
      receiverSparkAddress,
    });

    return promise;
  }, 60_000);
});

const createSparkSignerFactory =
  (turnkey: Turnkey) => async (accounts: WalletAccounts) =>
    new TurnkeySparkSigner({
      client: turnkey,
      sparkAddress: accounts.sparkIdentityAccount.address,
      ecdsaAddress: accounts.ecdsaIdentityAccount.address,
      identityPublicKeyHex: accounts.sparkIdentityAccount.publicKey!,
      depositPublicKeyHex: accounts.sparkDepositAccount.publicKey!,
      walletId: accounts.walletId,
    });

const createSparkWallet = (signer: TurnkeySparkSigner) =>
  TurnkeySparkWallet.initialize({
    signer,
    options: {
      network: NETWORK,
      electrsUrl: DEFAULT_SPARK_REGTEST_ELECTRS_URL,
      signerWithPreExistingKeys: true,
    },
  }).then(({ wallet }) => wallet);

const createGetWalletIdByName =
  (client: TurnkeyApiClient) => async (walletName: string) =>
    client
      .getWallets()
      .then(
        ({ wallets }) =>
          wallets.find((w) => w.walletName === walletName)?.walletId,
      );

const createWalletFactory =
  (client: TurnkeyApiClient) => (walletName: string) =>
    client
      .createWallet({
        walletName,
        accounts: [
          // Spark identity accounts
          {
            curve: Curve.SECP256K1,
            pathFormat: "PATH_FORMAT_BIP32",
            path: SPARK_IDENTITY_PATH,
            addressFormat: "ADDRESS_FORMAT_SPARK_REGTEST",
          },
          {
            curve: Curve.SECP256K1,
            pathFormat: "PATH_FORMAT_BIP32",
            path: SPARK_IDENTITY_PATH,
            addressFormat: "ADDRESS_FORMAT_COMPRESSED",
          },
          // Spark deposit account
          {
            curve: Curve.SECP256K1,
            pathFormat: "PATH_FORMAT_BIP32",
            path: SPARK_DEPOSIT_PATH,
            addressFormat: "ADDRESS_FORMAT_COMPRESSED",
          },
          // BTC account
          {
            curve: Curve.SECP256K1,
            pathFormat: "PATH_FORMAT_BIP32",
            path: BTC_PATH,
            addressFormat: "ADDRESS_FORMAT_BITCOIN_REGTEST_P2TR",
          },
        ],
      })
      .then(({ walletId }) => walletId);

interface WalletAccounts {
  walletId: string;
  ecdsaIdentityAccount: v1WalletAccount;
  sparkIdentityAccount: v1WalletAccount;
  sparkDepositAccount: v1WalletAccount;
  btcAccount: v1WalletAccount;
}

const createGetWalletAccounts =
  (client: TurnkeyApiClient) =>
  async (walletId: string): Promise<WalletAccounts> => {
    const { accounts } = await client.getWalletAccounts({
      walletId,
    });

    const ecdsaIdentityAccount = accounts.find(
      ({ path, addressFormat }) =>
        path === SPARK_IDENTITY_PATH &&
        addressFormat === "ADDRESS_FORMAT_COMPRESSED",
    );
    const sparkIdentityAccount = accounts.find(
      ({ path, addressFormat }) =>
        path === SPARK_IDENTITY_PATH &&
        addressFormat === "ADDRESS_FORMAT_SPARK_REGTEST",
    );
    const sparkDepositAccount = accounts.find(
      ({ path }) => path === SPARK_DEPOSIT_PATH,
    );
    const btcAccount = accounts.find(
      ({ path, addressFormat }) =>
        path === BTC_PATH &&
        addressFormat === "ADDRESS_FORMAT_BITCOIN_REGTEST_P2TR",
    );

    assert(
      ecdsaIdentityAccount != null,
      "Missing ECDSA identity account in wallet",
    );
    assert(
      sparkIdentityAccount != null,
      "Missing Spark identity account in wallet",
    );
    assert(sparkDepositAccount != null, "Missing deposit account in wallet");
    assert(btcAccount != null, "Missing BTC account in wallet");

    return {
      walletId,
      ecdsaIdentityAccount,
      sparkIdentityAccount,
      sparkDepositAccount,
      btcAccount,
    };
  };

// interface TurnkeyL1DepositOptions {
//   wallet: TurnkeySparkWallet;
//   turnkeyClient: Turnkey;
//   fundingAddress: string;
//   fundingPublicKeyHex: string;
//   existingTxid?: string | undefined;
//   amountSats?: bigint | undefined;
//   feeSats?: bigint | undefined;
//   electrsUrl?: string | undefined;
//   fundingTimeoutMs?: number | undefined;
//   fundingPollMs?: number | undefined;
//   confirmationTimeoutMs?: number | undefined;
//   confirmationPollMs?: number | undefined;
//   log?: ((message: string) => void) | undefined;
// }

// interface TurnkeyL1DepositResult {
//   txid: string;
//   depositAddress?: string;
//   depositSats?: bigint;
//   feeSats?: bigint;
//   status: TxStatus;
//   balanceSats: bigint;
// }

// async function depositTurnkeyL1ToSpark(
//   options: TurnkeyL1DepositOptions,
// ): Promise<TurnkeyL1DepositResult> {
//   const log = options.log ?? (() => undefined);
//   const electrsUrl = options.electrsUrl ?? DEFAULT_SPARK_REGTEST_ELECTRS_URL;
//   const fundingPublicKey = xOnlyPublicKey(options.fundingPublicKeyHex);
//   const fundingPayment = btc.p2tr(fundingPublicKey, undefined, REGTEST_NETWORK);
//   if (fundingPayment.address !== options.fundingAddress) {
//     throw new Error(
//       `L1 funding public key does not derive the funding address. ` +
//         `Expected ${fundingPayment.address}, got ${options.fundingAddress}`,
//     );
//   }

//   if (options.existingTxid) {
//     // Retry path for an already-broadcast L1 tx. The pre-broadcast advancedDeposit
//     // window is closed: the refund tree must be signed via claimDeposit post-confirm,
//     // which trusts operators not to refuse. This is asymmetric with the happy path
//     // below — and intentional, because there's no way to recover the pre-broadcast
//     // invariant once the deposit is on-chain.
//     log(`Using existing L1 deposit txid: ${options.existingTxid}`);
//     const status = await waitForConfirmation({
//       txid: options.existingTxid,
//       electrsUrl,
//       timeoutMs: options.confirmationTimeoutMs,
//       pollMs: options.confirmationPollMs,
//       log,
//     });

//     await claimDeposit(options.wallet, options.existingTxid);
//     const balance = await options.wallet.getBalance();
//     return {
//       txid: options.existingTxid,
//       status,
//       balanceSats: balance.satsBalance?.available ?? 0,
//     };
//   }

//   const depositAddress = await options.wallet.getSingleUseDepositAddress();
//   log(`Spark L1 deposit address: ${depositAddress}`);

//   const utxos = await waitForFundingUtxos({
//     address: options.fundingAddress,
//     electrsUrl,
//     timeoutMs: options.fundingTimeoutMs,
//     pollMs: options.fundingPollMs,
//     log,
//   });

//   const totalSats = utxos.reduce((sum, utxo) => sum + BigInt(utxo.value), 0n);
//   const feeSats = options.feeSats ?? 500n;
//   const depositSats = options.amountSats ?? totalSats - feeSats;
//   const changeSats = totalSats - depositSats - feeSats;

//   if (depositSats <= 0n || changeSats < 0n) {
//     throw new Error(
//       `Insufficient funds. Available=${totalSats}, requested=${depositSats}, fee=${feeSats}`,
//     );
//   }

//   const tx = new btc.Transaction({ allowUnknownOutputs: true });
//   for (const utxo of utxos) {
//     tx.addInput({
//       txid: utxo.txid,
//       index: utxo.vout,
//       witnessUtxo: {
//         amount: BigInt(utxo.value),
//         script: fundingPayment.script,
//       },
//       tapInternalKey: fundingPublicKey,
//     });
//   }
//   tx.addOutputAddress(depositAddress, depositSats, REGTEST_NETWORK);
//   if (changeSats >= DUST_SATS) {
//     tx.addOutputAddress(options.fundingAddress, changeSats, REGTEST_NETWORK);
//   }

//   const actualFeeSats =
//     feeSats + (changeSats > 0n && changeSats < DUST_SATS ? changeSats : 0n);
//   if (changeSats > 0n && changeSats < DUST_SATS) {
//     log(`Adding ${changeSats} sats below dust threshold to miner fee`);
//   }

//   const balanceBefore = await options.wallet.getBalance();
//   const minBalanceSats =
//     balanceSatsToBigInt(balanceBefore.satsBalance?.available) + depositSats;

//   log(
//     "Preparing Spark deposit tree and refund transactions before L1 broadcast",
//   );
//   await options.wallet.advancedDeposit(tx.hex);

//   log(
//     `Signing L1 deposit transaction: ${depositSats} sats to Spark, ${actualFeeSats} sats fee`,
//   );

//   const signed = await options.turnkeyClient.apiClient().signTransaction({
//     signWith: options.fundingAddress,
//     unsignedTransaction: bytesToHex(tx.toPSBT()),
//     type: "TRANSACTION_TYPE_BITCOIN",
//   });

//   const signedTx = btc.Transaction.fromPSBT(
//     hexToBytes(signed.signedTransaction),
//     {
//       allowUnknownOutputs: true,
//     },
//   );
//   signedTx.finalize();

//   // Surface the signed tx before broadcast. advancedDeposit has already consumed
//   // the deposit address upstream, so a broadcast failure here strands the leaf
//   // tree until this exact hex reaches the network. Logging the hex + txid lets
//   // the user recover by rebroadcasting via any Bitcoin node, then re-running
//   // with L1_DEPOSIT_TXID to pick up from the confirmation step.
//   const signedTxid = signedTx.id;
//   log(
//     `Signed L1 deposit ready (txid ${signedTxid}). If broadcast fails, ` +
//       `rebroadcast the hex below via any Bitcoin node and rerun with ` +
//       `L1_DEPOSIT_TXID=${signedTxid}:`,
//   );
//   log(signedTx.hex);

//   const txid = await postElectrsText(electrsUrl, "/tx", signedTx.hex);
//   log(`Broadcast L1 txid: ${txid}`);
//   log(
//     `Set L1_DEPOSIT_TXID=${txid} to retry claiming without spending another UTXO.`,
//   );

//   const status = await waitForConfirmation({
//     txid,
//     electrsUrl,
//     timeoutMs: options.confirmationTimeoutMs,
//     pollMs: options.confirmationPollMs,
//     log,
//   });

//   const availableBalance = await waitForSparkAvailableBalance({
//     wallet: options.wallet,
//     minBalanceSats,
//     timeoutMs: options.confirmationTimeoutMs,
//     pollMs: options.confirmationPollMs,
//     log,
//   });
//   return {
//     txid,
//     depositAddress,
//     depositSats,
//     feeSats: actualFeeSats,
//     status,
//     balanceSats: availableBalance,
//   };
// }
