import { hashTypedData, serializeTransaction, signatureToHex } from "viem";
import { toAccount } from "viem/accounts";
import { hashMessage, isAddress } from "viem";
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
import type { TurnkeyBrowserClient } from "@turnkey/sdk-browser";
import type { TurnkeyServerClient } from "@turnkey/sdk-server";

export async function createAccount(input: {
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient;
  organizationId: string;
  // This can be a wallet account address, private key address, or private key ID.
  signWith: string;
  // Ethereum address to use for this account, in the case that a private key ID is used to sign.
  // If left undefined, `createAccount` will fetch it from the Turnkey API.
  // We recommend setting this if you're using a passkey client, so that your users are not prompted for a passkey signature just to fetch their address.
  // You may leave this undefined if using an API key client.
  ethereumAddress?: string;
}): Promise<LocalAccount> {
  const { client, organizationId, signWith } = input;
  let { ethereumAddress } = input;

  if (!signWith) {
    throw new TurnkeyActivityError({
      message: `Missing signWith parameter`,
    });
  }

  if (isAddress(signWith)) {
    // override provided `ethereumAddress`
    ethereumAddress = signWith;
  } else if (!ethereumAddress) {
    // we have a private key ID, but not an ethereumAddress
    const data = await client.getPrivateKey({
      privateKeyId: signWith,
      organizationId: organizationId,
    });

    ethereumAddress = data.privateKey.addresses.find(
      (item: any) => item.format === "ADDRESS_FORMAT_ETHEREUM"
    )?.address;

    if (typeof ethereumAddress !== "string" || !ethereumAddress) {
      throw new TurnkeyActivityError({
        message: `Unable to find Ethereum address for key ${signWith} under organization ${organizationId}`,
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
      return signMessage(client, message, organizationId, signWith);
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
        signWith
      );
    },
    signTypedData: function (
      typedData: TypedData | { [key: string]: unknown }
    ): Promise<Hex> {
      return signTypedData(client, typedData, organizationId, signWith);
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
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  message: SignableMessage,
  organizationId: string,
  signWith: string
): Promise<Hex> {
  const hashedMessage = hashMessage(message);
  const signedMessage = await signMessageWithErrorWrapping(
    client,
    hashedMessage,
    organizationId,
    signWith
  );
  return `${signedMessage}` as Hex;
}

async function signTransaction<
  TTransactionSerializable extends TransactionSerializable
>(
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  transaction: TTransactionSerializable,
  serializer: SerializeTransactionFn<TTransactionSerializable>,
  organizationId: string,
  signWith: string
): Promise<Hex> {
  const serializedTx = serializer(transaction);
  const nonHexPrefixedSerializedTx = serializedTx.replace(/^0x/, "");
  return await signTransactionWithErrorWrapping(
    client,
    nonHexPrefixedSerializedTx,
    organizationId,
    signWith
  );
}

async function signTypedData(
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  data: TypedData | { [key: string]: unknown },
  organizationId: string,
  signWith: string
): Promise<Hex> {
  const hashToSign = hashTypedData(data as HashTypedDataParameters);

  return await signMessageWithErrorWrapping(
    client,
    hashToSign,
    organizationId,
    signWith
  );
}

async function signTransactionWithErrorWrapping(
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  unsignedTransaction: string,
  organizationId: string,
  signWith: string
): Promise<Hex> {
  let signedTx: string;
  try {
    signedTx = await signTransactionImpl(
      client,
      unsignedTransaction,
      organizationId,
      signWith
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
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  unsignedTransaction: string,
  organizationId: string,
  signWith: string
): Promise<string> {
  if (client instanceof TurnkeyClient) {
    const { activity } = await client.signTransaction({
      type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
      organizationId: organizationId,
      parameters: {
        signWith,
        type: "TRANSACTION_TYPE_ETHEREUM",
        unsignedTransaction: unsignedTransaction,
      },
      timestampMs: String(Date.now()), // millisecond timestamp
    });

    const { id, status, type } = activity;

    if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
      throw new TurnkeyActivityError({
        message: `Invalid activity status: ${activity.status}`,
        activityId: id,
        activityStatus: status,
        activityType: type,
      });
    }

    return assertNonNull(
      activity?.result?.signTransactionResult?.signedTransaction
    );
  } else {
    // Want to get additional activity details here
    const activity = await client.signTransaction({
      signWith,
      type: "TRANSACTION_TYPE_ETHEREUM",
      unsignedTransaction: unsignedTransaction,
    });

    return assertNonNull(activity?.signedTransaction);
  }
}

async function signMessageWithErrorWrapping(
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  message: string,
  organizationId: string,
  signWith: string
): Promise<Hex> {
  let signedMessage: string;
  try {
    signedMessage = await signMessageImpl(
      client,
      message,
      organizationId,
      signWith
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
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  message: string,
  organizationId: string,
  signWith: string
): Promise<string> {
  let result;

  if (client instanceof TurnkeyClient) {
    const { activity } = await client.signRawPayload({
      type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
      organizationId: organizationId,
      parameters: {
        signWith,
        payload: message,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NO_OP",
      },
      timestampMs: String(Date.now()), // millisecond timestamp
    });

    const { id, status, type } = activity;

    if (status !== "ACTIVITY_STATUS_COMPLETED") {
      throw new TurnkeyActivityError({
        message: `Invalid activity status: ${activity.status}`,
        activityId: id,
        activityStatus: status,
        activityType: type,
      });
    }

    result = assertNonNull(activity?.result?.signRawPayloadResult);
  } else {
    // Want to get ID and status back as well in the result (we won't get an error)
    // Maybe do a try/catch?
    result = await client.signRawPayload({
      signWith,
      payload: message,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
    });
  }

  let assembled = signatureToHex({
    r: `0x${result!.r}`,
    s: `0x${result!.s}`,
    v: result!.v === "00" ? 27n : 28n,
  });

  // Assemble the hex
  return assertNonNull(assembled);
}

function assertNonNull<T>(input: T | null | undefined): T {
  if (input == null) {
    throw new Error(`Got unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
