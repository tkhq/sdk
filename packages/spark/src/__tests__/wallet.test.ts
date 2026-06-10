import {
  Turnkey,
  TurnkeyApiClient,
  v1WalletAccount,
} from "@turnkey/sdk-server";
import {
  SparkReadonlyClient,
  SparkRequestError,
  SparkWalletEvent,
} from "@buildonspark/spark-sdk";
import type {
  LightningSendRequest,
  ExitSpeed,
  WalletTransfer,
} from "@buildonspark/spark-sdk/dist/types";
import assert from "node:assert";
import { Curve } from "@turnkey/core";
import {
  selectInputUTXOs,
  TurnkeyBitcoinSigner,
  smallestUTXOValueFirst,
} from "@turnkey/bitcoin";
import { SPARK_DEPOSIT_SUFFIX, SPARK_IDENTITY_SUFFIX } from "../constants";
import { TurnkeySparkSigner } from "../signer";
import { TurnkeySparkWalletTest } from "../test-wallet";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import mempoolJS from "@mempool/mempool.js";
import asyncRetry from "async-retry";

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

// Since these tests can take some time and depend on account balances
// and availability of a regtest mempool API, we might want to disable them if need be.
const DISABLE_SPARK_E2E_TESTS = !!process.env.DISABLE_SPARK_E2E_TESTS?.trim();

// If the tests are disabled, we just want to mark them as skipped
const describeMaybe = DISABLE_SPARK_E2E_TESTS ? describe.skip : describe;

describeMaybe("TurnkeySparkWallet", () => {
  let turnkey: Turnkey;
  let client: TurnkeyApiClient;

  let receiverAccounts: WalletAccounts;
  let senderAccounts: WalletAccounts;

  let senderSigner: TurnkeySparkSigner;
  let receiverSigner: TurnkeySparkSigner;

  let senderWallet: TurnkeySparkWalletTest;
  let receiverWallet: TurnkeySparkWalletTest;

  beforeAll(async () => {
    bitcoin.initEccLib(ecc);

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

    if (satsBalance.available < SATS_REQUIRED_FOR_TESTS) {
      const message = createWalletDepletedMessage(transferAddress, satsBalance);

      // We'll create a github actions error if the sender wallet is depleted and doesn't have enough balance for the tests
      await warn(message);

      // And stop the tests
      throw new Error(message);
    } else if (satsBalance.available < SATS_CLOSE_TO_DEPLETED) {
      // We'll create a github actions warning if the sender wallet is close to being depleted
      await warn(
        createWalletAlmostDepletedMessage(transferAddress, satsBalance),
      );
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // We'll try to recover any funds transferred to the receiver wallet
    //
    // Since these tests can run in parallel, we want to wrap this in try/catch
    // to avoid race conditions between tests tearing down the suite
    try {
      await recoverAllFunds(receiverWallet, senderWallet);
    } catch (error) {
      await warn(`Failed to recover funds from receiver wallet:\n\n${error}`);
    }

    await senderWallet.cleanup();
    await receiverWallet.cleanup();
  }, TEST_TIMEOUT);

  it(
    "should be able to transfer",
    async () => {
      let transfer: WalletTransfer | undefined = undefined;
      const receiverSparkAddress = await receiverWallet.getSparkAddress();

      // We need to setup the event listeners before creating the transfer, otherwise we might miss the events
      const claimed = waitForTransferToBeClaimed(
        receiverWallet,
        (id) => id === transfer?.id,
      );

      transfer = await asyncRetry(
        createBailOnUnexpectedTransferError(() =>
          senderWallet.transfer({
            amountSats: 100,
            receiverSparkAddress,
          }),
        ),
      );

      expect(transfer).toBeDefined();

      return claimed;
    },
    TEST_TIMEOUT,
  );

  it(
    "should be able to withdraw a specific amount",
    async () => {
      const amountSats = 1000;
      const withdrawalAddress = receiverAccounts.btcAccount.address;

      const feeQuote = await senderWallet.getWithdrawalFeeQuote({
        amountSats,
        withdrawalAddress,
      });

      expect(feeQuote).not.toBeNull();

      const feeAmountSats =
        (feeQuote!.l1BroadcastFeeFast?.originalValue || 0) +
        (feeQuote!.userFeeFast?.originalValue || 0);

      const coopExitRequest = await senderWallet.withdraw({
        amountSats,
        onchainAddress: withdrawalAddress,
        deductFeeFromWithdrawalAmount: false,
        feeQuoteId: feeQuote?.id!,
        feeAmountSats,
        exitSpeed: "FAST" as ExitSpeed,
      });

      expect(coopExitRequest).toBeDefined();
      expect(coopExitRequest!.coopExitTxid).toBeDefined();

      await warn(`Sent withdrawal request with txid ${coopExitRequest!.coopExitTxid}.
            
At the moment, withdrawal requests are leaking test funds into the BTC wallet ${withdrawalAddress}`);
    },
    TEST_TIMEOUT,
  );

  it(
    "should be able to claim a deposit from bitcoin regtest",
    async () => {
      const amount = 1000;
      const network = bitcoin.networks.regtest;
      const senderAddress = senderAccounts.btcAccount.address;

      const depositAddress = await senderWallet.getSingleUseDepositAddress();

      assert(
        typeof process.env.SPARK_API_URL === "string",
        "Missing required env var: SPARK_API_URL",
      );
      assert(
        typeof process.env.SPARK_API_USERNAME === "string",
        "Missing required env var: SPARK_API_USERNAME",
      );
      assert(
        typeof process.env.SPARK_API_PASSWORD === "string",
        "Missing required env var: SPARK_API_PASSWORD",
      );

      const mempoolUrl = process.env.SPARK_API_URL;
      const username = process.env.SPARK_API_USERNAME;
      const password = process.env.SPARK_API_PASSWORD;

      const senderSigner = new TurnkeyBitcoinSigner(
        client,
        senderAddress,
        bitcoin.address.fromBech32(senderAddress).data,
      );
      const mempoolApi = createMempoolApi(mempoolUrl, username, password);

      // Instead of doing the two-step signature process that would be appropriate for production
      // bitcoin transaction signing, we simply run our broadcast code with increasing fee amounts
      for (const fee of createIncreasingFee(500, 2000, 1.2)) {
        const amountWithFee = amount + fee;

        // Grab the UTXOs for the sender address from the mempool API
        const utxos = await mempoolApi.bitcoin.addresses.getAddressTxsUtxo({
          address: senderAddress,
        });

        // We want to optimize for consolidation by using the smallest UTXOs first
        utxos.sort(smallestUTXOValueFirst);

        // Select the UTXOs we want to use for the transaction
        const [selectedUtxos, change] = selectInputUTXOs(utxos, amountWithFee);

        // Construct the psbt
        //
        // - First we add all selected input UTXOs
        // - Then we add the output for the actual deposit
        // - Finally we add the change that will be returned to the sender
        const psbt = selectedUtxos
          .reduce(
            (psbt, utxo) =>
              psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                  script: bitcoin.address.toOutputScript(
                    senderAddress,
                    network,
                  ),
                  value: utxo.value,
                },
              }),
            new bitcoin.Psbt({ network }),
          )
          .addOutput({
            script: bitcoin.address.toOutputScript(depositAddress, network),
            value: amount,
          })
          .addOutput({
            script: bitcoin.address.toOutputScript(senderAddress, network),
            value: Number(change),
          });

        // Sign the transaction with Turnkey
        const { signedTransaction } = await senderSigner.signTransaction(
          psbt.toHex(),
        );

        // Finalize all inputs (Turnkey doesn't do this automatically)
        const signedPsbt = bitcoin.Psbt.fromHex(signedTransaction, {
          network,
        }).finalizeAllInputs();

        const rawTransaction = signedPsbt.extractTransaction();
        const txId = rawTransaction.getId();
        const txHex = rawTransaction.toHex();

        // Broadcast the transaction
        //
        // If an error occurs, we assume it has to do with low fees and we try again with a higher fee
        try {
          const response = await mempoolApi.bitcoin.transactions.postTx({
            txhex: txHex,
          });

          expect(typeof response).toBe("string");
          expect(response).toBe(txId);

          console.log(
            `Successfully broadcasted transaction with txid ${txId} and fee ${fee} sats.`,
          );
        } catch (error) {
          // We might get all sorts of errors back (AxiosError, Error etc)
          const message =
            (error as any)?.response?.data ||
            (error as any)?.message ||
            String(error);

          await warn(
            `Failed to broadcast Spark deposit transaction with txid ${txId} and fee ${fee} sats. Retrying with higher fee...\n\nError: ${message}`,
          );

          continue;
        }

        // Wait for the confirmation
        while (true) {
          console.log(
            `Polling for transaction with txid ${txId} to be confirmed`,
          );

          const status = await mempoolApi.bitcoin.transactions.getTxStatus({
            txid: txId,
          });

          if (status.confirmed) break;
        }

        // And finally, we claim the deposit in the wallet
        const leaves = await senderWallet.claimDeposit(txId);
        expect(leaves).toBeDefined();

        // We break out of the fee loop after a successful claim
        return;
      }

      throw new Error(
        `Failed to claim deposit after trying multiple fee amounts.`,
      );
    },
    TEST_TIMEOUT,
  );

  it(
    "should be able to create and pay a lightning invoice using spark",
    async () => {
      // We create a lightning invoice with the wallet and include a Spark invoice
      const invoice = await receiverWallet.createLightningInvoice({
        amountSats: 100,
        includeSparkInvoice: true,
      });

      let transfer: LightningSendRequest | WalletTransfer | undefined =
        undefined;

      // We setup a claim listener on the receiver wallet
      const claimed = waitForTransferToBeClaimed(
        receiverWallet,
        (id) => id === transfer?.id,
      );

      transfer = await senderWallet.payLightningInvoice({
        invoice: invoice.invoice.encodedInvoice,
        maxFeeSats: 2000,
        preferSpark: true,
      });

      // We check whether we got a WalletTransfer back
      expect(transfer).toEqual(
        expect.objectContaining({
          type: expect.any(String),
        }),
      );

      return claimed;
    },
    TEST_TIMEOUT,
  );

  it(
    "should be able to create and pay a lightning invoice not using spark",
    async () => {
      // We create a lightning invoice with the wallet
      const invoice = await receiverWallet.createLightningInvoice({
        amountSats: 100,
        includeSparkInvoice: false,
      });

      let lightningSendRequest: LightningSendRequest | undefined = undefined;

      // We setup a claim listener on the receiver wallet
      //
      // We can't match the claimed transfer ID with the invoice directly -
      // we need to get the transfer's userRequest and match that against the invoice ID
      const claimed = waitForTransferToBeClaimed(receiverWallet, async (id) => {
        const claimedTransfer = await receiverWallet.getTransfer(id);

        return claimedTransfer?.userRequest?.id === invoice.id;
      });

      lightningSendRequest = (await senderWallet.payLightningInvoice({
        invoice: invoice.invoice.encodedInvoice,
        maxFeeSats: 2000,
        preferSpark: false,
      })) as LightningSendRequest;

      // We check whether we really got a LightningSendRequest
      expect(lightningSendRequest).toEqual(
        expect.objectContaining({
          typename: "LightningSendRequest",
          transfer: expect.objectContaining({
            sparkId: expect.any(String),
          }),
        }),
      );

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
  wallet: TurnkeySparkWalletTest,
  onTransfer: (claimedTransferId: string) => boolean | Promise<boolean>,
): Promise<void> => {
  const { promise, resolve, reject } = Promise.withResolvers<void>();

  const handler = async (claimedTransferId: string): Promise<void> => {
    try {
      // onTransfer should return true if this is the transfer we are waiting for
      if (await onTransfer(claimedTransferId)) {
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
 * Generator function for creating increasing fee amounts to try broadcasting a transaction with
 * different fee levels.
 *
 * @param start The starting fee amount.
 * @param end The maximum fee amount.
 * @param multiplier The multiplier to increase the fee by on each iteration.
 */
function* createIncreasingFee(
  start: number,
  end: number,
  multiplier: number,
): Generator<number> {
  let current = start;

  while (current <= end) {
    yield current;

    current = Math.ceil(current * multiplier);
  }
}

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
  TurnkeySparkWalletTest.initialize({
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

const recoverAllFunds = async (
  fromWallet: TurnkeySparkWalletTest,
  toWallet: TurnkeySparkWalletTest,
) => {
  const {
    satsBalance: { available },
  } = await fromWallet.getBalance();

  // Don't do anything if there is nothing to recover
  if (available === BigInt(0)) {
    return;
  }

  const toAddress = await toWallet.getSparkAddress();

  // We need to setup the event listeners before creating the transfer, otherwise we might miss the events
  let transfer: WalletTransfer | undefined = undefined;
  const claimed = waitForTransferToBeClaimed(
    toWallet,
    (id) => id === transfer?.id,
  );

  transfer = await fromWallet.transfer({
    amountSats: Number(available),
    receiverSparkAddress: toAddress,
  });

  await claimed;
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

const createMempoolApi = (
  baseUrl: string,
  username?: string,
  password?: string,
) => {
  const url = new URL(baseUrl);
  const Authorization =
    username && password
      ? `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
      : "";

  return mempoolJS({
    protocol: url.protocol.replaceAll(":", "") as "http" | "https",
    hostname: url.host,
    config: {
      headers: {
        Authorization,
        // We need to force the content type to be text/plain to be able to broadcast a transaction
        //
        // This is because of axios default behavior when it comes to content type.
        // If the body is a string (which is the case for /api/tx payload),
        // it sets the content type (incorrectly) to application/x-www-form-urlencoded
        "Content-Type": "text/plain",
      },
    },
  });
};

/**
 * Since we are reusing the same account for all tests, we might run into TRANSFER_LOCKED errors
 * if we try to transfer funds that are already locked by a pending transfer.
 *
 * This function wraps a call that can potentially throw a TRANSFER_LOCKED error and retries it if that happens,
 * while bailing on any other error.
 *
 * See https://github.com/tkhq/sdk/actions/runs/27298318153/job/80637353586
 */
const createBailOnUnexpectedTransferError =
  <T>(fn: () => Promise<T>) =>
  async (bail: (e: Error) => void) => {
    try {
      return await fn();
    } catch (error) {
      if (
        !(error instanceof SparkRequestError) ||
        !error.message.includes("TRANSFER_LOCKED")
      ) {
        bail(error as Error);

        return undefined;
      } else {
        throw error;
      }
    }
  };

// Print out a warning / github annotation if the tests are disabled
if (DISABLE_SPARK_E2E_TESTS) {
  warn("Spark E2E tests are disabled");
}
