import { hashTypedData, serializeTransaction, signatureToHex } from "viem";
import { toAccount } from "viem/accounts";
import { hashMessage } from "viem";
import type {
  Hex,
  HashTypedDataParameters,
  LocalAccount,
  SerializeTransactionFn,
  SignableMessage,
  TransactionSerializable,
  TypedData,
} from "viem";
import { TurnkeyActivityError, TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

export async function createAccount(input: {
  client: TurnkeyClient;
  organizationId: string;
  privateKeyId: string;
  // Ethereum address to use for this account.
  // If left undefined, `createAccount` will fetch it from the Turnkey API.
  // We recommend setting this if you're using a passkey client, so that your users are not prompted for a passkey signature just to fetch their address.
  // You may leave this undefined if using an API key client.
  ethereumAddress?: string;
}): Promise<LocalAccount> {
  const { client, organizationId, privateKeyId } = input;
  let { ethereumAddress } = input;

  // Fetch the address if we don't have it
  if (ethereumAddress === undefined) {
    const data = await client.getPrivateKey({
      privateKeyId: privateKeyId,
      organizationId: organizationId,
    });

    ethereumAddress = data.privateKey.addresses.find(
      (item: any) => item.format === "ADDRESS_FORMAT_ETHEREUM"
    )?.address;

    if (typeof ethereumAddress !== "string" || !ethereumAddress) {
      throw new TurnkeyActivityError({
        message: `Unable to find Ethereum address for key ${privateKeyId} under organization ${organizationId}`,
      });
    }
  }

  return toAccount({
    address: ethereumAddress as Hex,
    signMessage: function ({
      message,
    }: {
      message: SignableMessage;
    }): Promise<Hex> {
      return signMessage(client, message, organizationId, privateKeyId);
    },
    signTransaction: function <
      TTransactionSerializable extends TransactionSerializable
    >(
      transaction: TTransactionSerializable,
      args?:
        | { serializer?: SerializeTransactionFn<TTransactionSerializable> }
        | undefined
    ): Promise<Hex> {
      const serializer = !args?.serializer
        ? serializeTransaction
        : args.serializer;

      return signTransaction(
        client,
        transaction,
        serializer,
        organizationId,
        privateKeyId
      );
    },
    signTypedData: function (
      typedData: TypedData | { [key: string]: unknown }
    ): Promise<Hex> {
      return signTypedData(client, typedData, organizationId, privateKeyId);
    },
  });
}

/**
 * Type bundling configuration for an API Key Viem account creation
 * @deprecated this is used only with {@link createApiKeyAccount}, a deprecated API. See {@link createAccount}.
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
 * @deprecated use {@link createAccount} instead.
 */
export async function createApiKeyAccount(
  config: TApiKeyAccountConfig
): Promise<LocalAccount> {
  const { apiPublicKey, apiPrivateKey, baseUrl, organizationId, privateKeyId } =
    config;

  const stamper = new ApiKeyStamper({
    apiPublicKey: apiPublicKey,
    apiPrivateKey: apiPrivateKey,
  });

  const client = new TurnkeyClient(
    {
      baseUrl: baseUrl,
    },
    stamper
  );

  const data = await client.getPrivateKey({
    privateKeyId: privateKeyId,
    organizationId: organizationId,
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
    address: ethereumAddress as Hex,
    signMessage: function ({
      message,
    }: {
      message: SignableMessage;
    }): Promise<Hex> {
      return signMessage(client, message, organizationId, privateKeyId);
    },
    signTransaction: function <
      TTransactionSerializable extends TransactionSerializable
    >(
      transaction: TTransactionSerializable,
      args?:
        | { serializer?: SerializeTransactionFn<TTransactionSerializable> }
        | undefined
    ): Promise<Hex> {
      const serializer = !args?.serializer
        ? serializeTransaction
        : args.serializer;

      return signTransaction(
        client,
        transaction,
        serializer,
        organizationId,
        privateKeyId
      );
    },
    signTypedData: function (
      typedData: TypedData | { [key: string]: unknown }
    ): Promise<Hex> {
      return signTypedData(client, typedData, organizationId, privateKeyId);
    },
  });
}

async function signMessage(
  client: TurnkeyClient,
  message: SignableMessage,
  organizationId: string,
  privateKeyId: string
): Promise<Hex> {
  const hashedMessage = hashMessage(message);
  const signedMessage = await signMessageWithErrorWrapping(
    client,
    hashedMessage,
    organizationId,
    privateKeyId
  );
  return `${signedMessage}` as Hex;
}

async function signTransaction<
  TTransactionSerializable extends TransactionSerializable
>(
  client: TurnkeyClient,
  transaction: TTransactionSerializable,
  serializer: SerializeTransactionFn<TTransactionSerializable>,
  organizationId: string,
  privateKeyId: string
): Promise<Hex> {
  const serializedTx = serializer(transaction);
  const nonHexPrefixedSerializedTx = serializedTx.replace(/^0x/, "");
  return await signTransactionWithErrorWrapping(
    client,
    nonHexPrefixedSerializedTx,
    organizationId,
    privateKeyId
  );
}

async function signTypedData(
  client: TurnkeyClient,
  data: TypedData | { [key: string]: unknown },
  organizationId: string,
  privateKeyId: string
): Promise<Hex> {
  const hashToSign = hashTypedData(data as HashTypedDataParameters);

  return await signMessageWithErrorWrapping(
    client,
    hashToSign,
    organizationId,
    privateKeyId
  );
}

async function signTransactionWithErrorWrapping(
  client: TurnkeyClient,
  unsignedTransaction: string,
  organizationId: string,
  privateKeyId: string
): Promise<Hex> {
  let signedTx: string;
  try {
    signedTx = await signTransactionImpl(
      client,
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
  client: TurnkeyClient,
  unsignedTransaction: string,
  organizationId: string,
  privateKeyId: string
): Promise<string> {
  const { activity } = await client.signTransaction({
    type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
    organizationId: organizationId,
    parameters: {
      signWith: privateKeyId,
      type: "TRANSACTION_TYPE_ETHEREUM",
      unsignedTransaction: unsignedTransaction,
    },
    timestampMs: String(Date.now()), // millisecond timestamp
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
  client: TurnkeyClient,
  message: string,
  organizationId: string,
  privateKeyId: string
): Promise<Hex> {
  let signedMessage: string;
  try {
    signedMessage = await signMessageImpl(
      client,
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

  return signedMessage as Hex;
}

async function signMessageImpl(
  client: TurnkeyClient,
  message: string,
  organizationId: string,
  privateKeyId: string
): Promise<string> {
  const { activity } = await client.signRawPayload({
    type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
    organizationId: organizationId,
    parameters: {
      signWith: privateKeyId,
      payload: message,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
    },
    timestampMs: String(Date.now()), // millisecond timestamp
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
