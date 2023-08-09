import { hashTypedData, serializeTransaction, signatureToHex } from "viem";
import { toAccount } from "viem/accounts";
import { keccak256 } from "viem";
import type {
  HashTypedDataParameters,
  LocalAccount,
  SerializeTransactionFn,
  SignableMessage,
  TransactionSerializable,
  TypedData,
} from "viem";
import {
  TurnkeyApi,
  TurnkeyActivityError,
  init as httpInit,
} from "@turnkey/http";

/**
 * Type bundling configuration for an API Key Viem account creation
 */
type TApiKeyAccountConfig = {
  /**
   * Turnkey API public key
   */
  apiPublicKey: string;
  /**
   * Turnkey API private key
   */
  apiPrivateKey: string;
  /**
   * Turnkey API base URL
   */
  baseUrl: string;
  /**
   * Turnkey organization ID
   */
  organizationId: string;
  /**
   * Turnkey private key ID
   */
  privateKeyId: string;
};

/**
 * Creates a new Custom Account backed by a Turnkey API key.
 */
export async function createApiKeyAccount(
  config: TApiKeyAccountConfig
): Promise<LocalAccount> {
  const { apiPublicKey, apiPrivateKey, baseUrl, organizationId, privateKeyId } =
    config;

  httpInit({
    apiPublicKey,
    apiPrivateKey,
    baseUrl,
  });

  const data = await TurnkeyApi.getPrivateKey({
    body: {
      privateKeyId: privateKeyId,
      organizationId: organizationId,
    },
  });

  const ethereumAddress = data.privateKey.addresses.find(
    (item: any) => item.format === "ADDRESS_FORMAT_ETHEREUM"
  )?.address;

  if (typeof ethereumAddress !== "string" || !ethereumAddress) {
    throw new TurnkeyActivityError({
      message: `Unable to find Ethereum address for key ${privateKeyId} under organization ${organizationId}`,
    });
  }

  return toAccount({
    address: ethereumAddress as `0x${string}`,
    signMessage: function ({
      message,
    }: {
      message: SignableMessage;
    }): Promise<`0x${string}`> {
      return signMessage(message, organizationId, privateKeyId);
    },
    signTransaction: function <
      TTransactionSerializable extends TransactionSerializable
    >(
      transaction: TTransactionSerializable,
      args?:
        | { serializer?: SerializeTransactionFn<TTransactionSerializable> }
        | undefined
    ): Promise<`0x${string}`> {
      const serializer = !args?.serializer
        ? serializeTransaction
        : args.serializer;

      return signTransaction(
        transaction,
        serializer,
        organizationId,
        privateKeyId
      );
    },
    signTypedData: function (
      typedData: TypedData | { [key: string]: unknown }
    ): Promise<`0x${string}`> {
      return signTypedData(typedData, organizationId, privateKeyId);
    },
  });
}

async function signMessage(
  message: SignableMessage,
  organizationId: string,
  privateKeyId: string
): Promise<`0x${string}`> {
  const hashedMessage = keccak256(message as `0x${string}`);
  const signedMessage = await signMessageWithErrorWrapping(
    hashedMessage,
    organizationId,
    privateKeyId
  );
  return `${signedMessage}` as `0x${string}`;
}

async function signTransaction<
  TTransactionSerializable extends TransactionSerializable
>(
  transaction: TTransactionSerializable,
  serializer: SerializeTransactionFn<TTransactionSerializable>,
  organizationId: string,
  privateKeyId: string
): Promise<`0x${string}`> {
  const serializedTx = serializer(transaction);
  const nonHexPrefixedSerializedTx = serializedTx.replace(/^0x/, "");
  return await signTransactionWithErrorWrapping(
    nonHexPrefixedSerializedTx,
    organizationId,
    privateKeyId
  );
}

async function signTypedData(
  data: TypedData | { [key: string]: unknown },
  organizationId: string,
  privateKeyId: string
): Promise<`0x${string}`> {
  const hashToSign = hashTypedData(data as HashTypedDataParameters);

  return await signMessageWithErrorWrapping(
    hashToSign,
    organizationId,
    privateKeyId
  );
}

async function signTransactionWithErrorWrapping(
  unsignedTransaction: string,
  organizationId: string,
  privateKeyId: string
): Promise<`0x${string}`> {
  let signedTx: string;
  try {
    signedTx = await signTransactionImpl(
      unsignedTransaction,
      organizationId,
      privateKeyId
    );
  } catch (error) {
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: `Failed to sign transaction: ${(error as Error).message}`,
      cause: error as Error,
    });
  }

  return `0x${signedTx}`;
}

async function signTransactionImpl(
  unsignedTransaction: string,
  organizationId: string,
  privateKeyId: string
): Promise<string> {
  const { activity } = await TurnkeyApi.signTransaction({
    body: {
      type: "ACTIVITY_TYPE_SIGN_TRANSACTION",
      organizationId: organizationId,
      parameters: {
        privateKeyId: privateKeyId,
        type: "TRANSACTION_TYPE_ETHEREUM",
        unsignedTransaction: unsignedTransaction,
      },
      timestampMs: String(Date.now()), // millisecond timestamp
    },
  });

  const { id, status, type } = activity;

  if (activity.status === "ACTIVITY_STATUS_COMPLETED") {
    return assertNonNull(
      activity?.result?.signTransactionResult?.signedTransaction
    );
  }

  throw new TurnkeyActivityError({
    message: `Invalid activity status: ${activity.status}`,
    activityId: id,
    activityStatus: status,
    activityType: type,
  });
}

async function signMessageWithErrorWrapping(
  message: string,
  organizationId: string,
  privateKeyId: string
): Promise<`0x${string}`> {
  let signedMessage: string;
  try {
    signedMessage = await signMessageImpl(
      message,
      organizationId,
      privateKeyId
    );
  } catch (error) {
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: `Failed to sign: ${(error as Error).message}`,
      cause: error as Error,
    });
  }

  return signedMessage as `0x${string}`;
}

async function signMessageImpl(
  message: string,
  organizationId: string,
  privateKeyId: string
): Promise<string> {
  const { activity } = await TurnkeyApi.signRawPayload({
    body: {
      type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD",
      organizationId: organizationId,
      parameters: {
        privateKeyId: privateKeyId,
        payload: message,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NO_OP",
      },
      timestampMs: String(Date.now()), // millisecond timestamp
    },
  });

  const { id, status, type } = activity;

  if (activity.status === "ACTIVITY_STATUS_COMPLETED") {
    let result = assertNonNull(activity?.result?.signRawPayloadResult);

    let assembled = signatureToHex({
      r: `0x${result.r}`,
      s: `0x${result.s}`,
      v: result.v === "00" ? 27n : 28n,
    });

    // Assemble the hex
    return assertNonNull(assembled);
  }

  throw new TurnkeyActivityError({
    message: `Invalid activity status: ${activity.status}`,
    activityId: id,
    activityStatus: status,
    activityType: type,
  });
}

function assertNonNull<T>(input: T | null | undefined): T {
  if (input == null) {
    throw new Error(`Got unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
