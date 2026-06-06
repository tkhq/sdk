import {
  Turnkey,
  TurnkeyApiClient,
  v1WalletAccount,
} from "@turnkey/sdk-server";
import { SparkReadonlyClient, SparkWalletEvent } from "@buildonspark/spark-sdk";

import assert from "node:assert";
import { Curve } from "@turnkey/core";
import { SPARK_DEPOSIT_SUFFIX, SPARK_IDENTITY_SUFFIX } from "../constants";
import { TurnkeySparkSigner } from "../signer";
import { TurnkeySparkWallet } from "../wallet";
import type {
  Transfer,
  TreeNode,
} from "@buildonspark/spark-sdk/dist/proto/spark";

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

  let senderWallet: TurnekySparkWalletTest;
  let receiverWallet: TurnekySparkWalletTest;

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

    const apiBaseUrl = process.env.BASE_URL || "https://api.turnkey.com";
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

    // const txId = "a4b3b389a95053c83786ea51d0f1285c7d2207e6c3e006859314e14d3b3c9a7e"
    // const txId = "23c6755668ac34de0adb80bda653de5eb0f31dac546a4b14a315a7711927fc09"
    // const txId = "ac5fdd3ca9cc40ea6e6e3a8fc3752171e9d770e406b6ad47cb77b328901923fe"
    // const txId = "66e21c39acd22e41ef0c2727f0578f393c9a9a734983f8e6ea83446ca0dd8c76"
    // await senderWallet.claimDeposit(txId)

    const sparkClient = SparkReadonlyClient.createWithSigner(
      {
        network: NETWORK,
        electrsUrl: DEFAULT_SPARK_REGTEST_ELECTRS_URL,
      },
      senderSigner,
    );

    const transferAddress = senderAccounts.sparkIdentityAccount.address;
    const pendingTransfers =
      await sparkClient.getPendingTransfers(transferAddress);

    console.warn({ pendingTransfers });

    if (pendingTransfers.length > 0) {
      await senderWallet.__claimTransferBatch(pendingTransfers);
    }

    // Check that we got enough balance to run the tests
    const { satsBalance } = await senderWallet.getBalance();
    try {
      expect(satsBalance.available).toBeGreaterThanOrEqual(
        SATS_REQUIRED_FOR_TESTS,
      );
    } catch (error: unknown) {
      const transferAddress = senderAccounts.sparkIdentityAccount.address;
      const depositAddress = await senderWallet.getSingleUseDepositAddress();

      throw new Error(
        `Sender wallet has insufficient balance for tests (${satsBalance.available} available, ${satsBalance.incoming} incoming). Please fund the wallet with at least ${SATS_REQUIRED_FOR_TESTS} sats on regtest.

You can use the regtest faucet at https://app.lightspark.com/regtest-faucet 
to send 100000 sats to ${depositAddress} and claim the deposit by its transaction ID:

await senderWallet.claimDeposit(txId)

You can also request funds from the faucet to the Spark address ${transferAddress}
and the wallet should take care of claiming.

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

interface WalletWithClaimTransfer {
  claimTransfer({
    transfer,
    emit,
  }: {
    transfer: Transfer;
    emit?: boolean;
  }): Promise<TreeNode[]>;
  claimTransferBatch(transfers: Transfer[], emit?: boolean): Promise<string[]>;
}
class TurnekySparkWalletTest extends TurnkeySparkWallet {
  async __claimTransfer(transfer: Transfer) {
    return (this as unknown as WalletWithClaimTransfer).claimTransfer({
      transfer,
      emit: true,
    });
  }

  async __claimTransferBatch(transfers: Transfer[]) {
    return (this as unknown as WalletWithClaimTransfer).claimTransferBatch(
      transfers,
      true,
    );
  }
}

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
  TurnekySparkWalletTest.initialize({
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
