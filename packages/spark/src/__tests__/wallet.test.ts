import {
  Turnkey,
  TurnkeyApiClient,
  v1WalletAccount,
} from "@turnkey/sdk-server";
import { SparkReadonlyClient, SparkWalletEvent } from "@buildonspark/spark-sdk";
import type { WalletTransfer } from "@buildonspark/spark-sdk/dist/types";
import assert from "node:assert";
import { Curve } from "@turnkey/core";
import { SPARK_DEPOSIT_SUFFIX, SPARK_IDENTITY_SUFFIX } from "../constants";
import { TurnkeySparkSigner } from "../signer";
import { TurnekySparkWalletTest } from "../test-wallet";

const NETWORK = "REGTEST";

const SPARK_PURPOSE = "/8797555'";
const SPARK_ACCOUNT = "/0'";
const SPARK_IDENTITY_PATH = `m${SPARK_PURPOSE}${SPARK_ACCOUNT}${SPARK_IDENTITY_SUFFIX}`;
const SPARK_DEPOSIT_PATH = `m${SPARK_PURPOSE}${SPARK_ACCOUNT}${SPARK_DEPOSIT_SUFFIX}`;
const BTC_PATH = "m/86'/1'/0'/0/0";

const SENDER_WALLET_NAME = "Spark E2E Sender";
const RECEIVER_WALLET_NAME = "Spark E2E Receiver";

const SATS_CLOSE_TO_DEPLETED = 1000_000;
const SATS_REQUIRED_FOR_TESTS = 1000;

const TEST_TIMEOUT = 60_000; // 60 seconds, because claiming transfers can take a while

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

    // We'll print out the addresses so that we can fund them if need be
    console.table({
      sparkSender: { address: senderAccounts.sparkIdentityAccount.address },
      sparkReceiver: { address: receiverAccounts.sparkIdentityAccount.address },
      btcSender: { address: senderAccounts.btcAccount.address },
    });

    // Before doing anything, we check any pending transfers
    //
    // This is how these wallets get funded - we request funds in their faucet,
    // then this code claims those funds before running the tests
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
    if (pendingTransfers.length > 0) {
      await senderWallet.__claimTransferBatch__(pendingTransfers);
    }

    // Now that we claimed any pending transfers, we check that we got enough balance to run the tests
    const { satsBalance } = await senderWallet.getBalance();

    if (satsBalance.available < SATS_CLOSE_TO_DEPLETED) {
      // We'll create a github actions warning if the sender wallet is close to being depleted
      await warn(
        createWalletAlmostDepletedMessage(transferAddress, satsBalance),
      );
    } else if (satsBalance.available < SATS_REQUIRED_FOR_TESTS) {
      const message = createWalletDepletedMessage(transferAddress, satsBalance);

      // We'll create a github actions error if the sender wallet is depleted and doesn't have enough balance for the tests
      await warn(message);

      // And stop the tests
      throw new Error(message);
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // We'll try to recover any funds transferred to the receiver wallet
    //
    // Since these tests can run in parallel, we want to wrap this in try/catch
    // to avoid race conditions between tests tearing down the suite
    try {
      let transfer: WalletTransfer | undefined;
      const receiverSparkAddress = await senderWallet.getSparkAddress();
      const {
        satsBalance: { available },
      } = await receiverWallet.getBalance();

      // We need to setup the event listeners before creating the transfer, otherwise we might miss the events
      const claimed = waitForTransferToBeClaimed(
        senderWallet,
        (id) => id === transfer?.id,
      );

      transfer = await receiverWallet.transfer({
        amountSats: Number(available),
        receiverSparkAddress,
      });

      await claimed;
    } catch (error: unknown) {
      await warn(`Failed to recover funds from receiver wallet:\n\n${error}`);
    }

    await senderWallet.cleanup();
    await receiverWallet.cleanup();
  }, TEST_TIMEOUT);

  it(
    "should be able to transfer",
    async () => {
      let transfer: WalletTransfer | undefined;
      const receiverSparkAddress = await receiverWallet.getSparkAddress();

      // We need to setup the event listeners before creating the transfer, otherwise we might miss the events
      const claimed = waitForTransferToBeClaimed(
        receiverWallet,
        (id) => id === transfer?.id,
      );

      transfer = await senderWallet.transfer({
        amountSats: 100,
        receiverSparkAddress,
      });

      expect(transfer).toBeDefined();

      return claimed;
    },
    TEST_TIMEOUT,
  );
});

/**
 * Helper function that waits for a particular transfer to be claimed by the wallet
 *
 * Waiting for a transfer to be claimed is a bit tricky since we need to set the event handlers
 * before we have a reference to the actual transfer.
 *
 * What we do is setup the event handler on the wallet and let the onTransfer handle them,
 * instead of passing the transfer ID which we don't have
 */
const waitForTransferToBeClaimed = (
  wallet: TurnekySparkWalletTest,
  onTransfer: (claimedTransferId: string) => boolean,
): Promise<void> => {
  const { promise, resolve, reject } = Promise.withResolvers<void>();

  const handler = (claimedTransferId: string): void => {
    try {
      // onTransfer should return true if this is the transfer we are waiting for
      if (onTransfer(claimedTransferId)) {
        wallet.off(SparkWalletEvent.TransferClaimed, handler);

        resolve();
      }
    } catch (error: unknown) {
      // If the handler errors out, we propagate the error
      wallet.off(SparkWalletEvent.TransferClaimed, handler);

      reject(error);
    }
  };

  wallet.on(SparkWalletEvent.TransferClaimed, handler);

  return promise;
};

/**
 * Factory for a function that creates a TurnkeySparkSigner from the wallet accounts
 */
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

/**
 * Initializes a TurnkeySparkWalletTest instance from a TurnkeySparkSigner
 */
const createSparkWallet = (signer: TurnkeySparkSigner) =>
  TurnekySparkWalletTest.initialize({
    signer,
    options: {
      network: NETWORK,
      electrsUrl: DEFAULT_SPARK_REGTEST_ELECTRS_URL,
      signerWithPreExistingKeys: true,
    },
  }).then(({ wallet }) => wallet);

/**
 * Factory for a function that finds an existing wallet by name
 */
const createGetWalletIdByName =
  (client: TurnkeyApiClient) => async (walletName: string) =>
    client
      .getWallets()
      .then(
        ({ wallets }) =>
          wallets.find((w) => w.walletName === walletName)?.walletId,
      );

/**
 * Factory for a function that creates a wallet by name
 */
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

/**
 * Factory for a function that finds the accounts needed for tests
 */
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

const createFaucetMessage = (address: string) =>
  `You can use the regtest faucet at https://app.lightspark.com/regtest-faucet 
to send 100000 sats to ${address} and this test will take care of claiming and pending transfers.`;

const createWalletAlmostDepletedMessage = (
  address: string,
  balance: { available: bigint; incoming: bigint },
) =>
  `Sender wallet is close to being depleted with only ${balance.available} sats available and ${balance.incoming} sats incoming.

${createFaucetMessage(address)}`;

const createWalletDepletedMessage = (
  address: string,
  balance: { available: bigint; incoming: bigint },
) =>
  `Sender wallet has insufficient balance for tests with only ${balance.available} sats available and ${balance.incoming} sats incoming.

${createFaucetMessage(address)}`;

/**
 * Helper function that detects the runtime (github actions or local) and logs a warning message accordingly.
 */
const warn = async (message: string) => {
  if (process.env.GITHUB_ACTIONS) {
    const { warning } = await import("@actions/core");

    warning(message, { file: __filename });
  } else {
    console.warn(message);
  }
};
