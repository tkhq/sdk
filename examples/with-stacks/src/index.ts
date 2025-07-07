import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import {
  broadcastTransaction,
  createMessageSignature,
  createStacksPublicKey,
  leftPadHex,
  makeUnsignedContractCall,
  PubKeyEncoding,
  publicKeyIsCompressed,
  sigHashPreSign,
  SingleSigSpendingCondition,
  TransactionSigner,
  txidFromData,
  type StacksTransactionWire,
} from "@stacks/transactions";
import { hexToBytes } from "@stacks/common";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Define the Turnkey API client
const client = new TurnkeyServerSDK({
  apiBaseUrl: process.env.TURNKEY_BASE_URL!,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
});

const constructStacksTx = async (pubKey: string) => {
  let transaction = await makeUnsignedContractCall({
    contractAddress: "SP3TJMRQ13QR6V5HGT6AKEK7PP699F4148JZTB9G3",
    contractName: "counter",
    functionName: "increment",
    functionArgs: [],
    numSignatures: 1,
    publicKey: pubKey,
    postConditions: [],
    postConditionMode: "deny",
    network: "mainnet",
  });

  // The `signer` contains the `sigHash` property needed for the `preSignSigHash`
  const signer = new TransactionSigner(transaction);

  return { stacksTransaction: transaction, stacksTxSigner: signer };
};

const generatePreSignSigHash = (
  transaction: StacksTransactionWire,
  signer: TransactionSigner,
) => {
  let preSignSigHash = sigHashPreSign(
    signer.sigHash,
    transaction.auth.authType,
    transaction.auth.spendingCondition.fee,
    transaction.auth.spendingCondition.nonce,
  );

  return preSignSigHash;
};

const generatePostSignSigHash = (
  pubKey: string,
  preSignSigHash: string,
  nextSig: string,
) => {
  const RECOVERABLE_ECDSA_SIG_LENGTH_BYTES = 65;
  const hashLength = 32 + 1 + RECOVERABLE_ECDSA_SIG_LENGTH_BYTES;

  let pubKeyStacksWire = createStacksPublicKey(pubKey);

  const pubKeyEncoding = publicKeyIsCompressed(pubKeyStacksWire.data)
    ? PubKeyEncoding.Compressed
    : PubKeyEncoding.Uncompressed;

  const sigHash =
    preSignSigHash + leftPadHex(pubKeyEncoding.toString(16)) + nextSig;
  const sigHashBytes = hexToBytes(sigHash);

  if (sigHashBytes.byteLength > hashLength) {
    throw Error("Invalid signature hash length");
  }

  let nextSigHash = txidFromData(sigHashBytes);

  return nextSigHash;
};

const signStacksTx = async () => {
  try {
    const stacksPublicKey =
      "04d41c09b9fed50a3810f95245cb23fc32ae9d096ad44ab0f4bea7691877c0a33885a5bc71e89ed6571aef6daf838b3f685027df9a3121b4d7127f5ecdfb05dbb0";

    let { stacksTransaction, stacksTxSigner } = await constructStacksTx(
      stacksPublicKey!,
    );
    let preSignSigHash = generatePreSignSigHash(
      stacksTransaction,
      stacksTxSigner,
    );

    const payload = `0x${preSignSigHash}`;

    const signature = await client?.apiClient().signRawPayload({
      payload,
      signWith: stacksPublicKey,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
    });

    // r and s values returned are in hex format
    // may need to padStart r and s values
    // v should be "00" for Stacks but the returned "01" also works
    const nextSig = `${signature!.v}${signature!.r.padStart(
      64,
      "0",
    )}${signature!.s.padStart(64, "0")}`;

    let nextSigHash = generatePostSignSigHash(
      stacksPublicKey!,
      preSignSigHash,
      nextSig,
    );

    // Reassign current sigHash with `nextSigHash`
    stacksTxSigner.sigHash = nextSigHash;

    // Reassign signature field in transaction with `nextSig`
    let spendingCondition = stacksTransaction.auth
      .spendingCondition as SingleSigSpendingCondition;
    spendingCondition.signature = createMessageSignature(nextSig);

    return stacksTransaction;
  } catch (err) {
    console.error("Signing failed:", err);
    return undefined;
  }
};

const handleBroadcastTx = async () => {
  let tx = await signStacksTx();

  let result = await broadcastTransaction({
    transaction: tx!,
    network: "mainnet",
  });

  console.log("Broadcast Result:");
  console.dir(result, { depth: null });
};

(async () => {
  await handleBroadcastTx();
})();
