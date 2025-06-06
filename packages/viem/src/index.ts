import {
  BaseError,
  hashMessage,
  isAddress,
  hashTypedData,
  serializeTransaction,
  hexToBigInt,
  hexToBytes,
  parseTransaction,
} from "viem";
import {
  SignAuthorizationReturnType,
  toAccount,
  SignAuthorizationParameters,
} from "viem/accounts";
import type {
  Hex,
  HashTypedDataParameters,
  LocalAccount,
  SerializeTransactionFn,
  SignableMessage,
  TransactionSerializable,
  TypedData,
} from "viem";
import { hashAuthorization } from "viem/utils";
import { secp256k1 } from "@noble/curves/secp256k1";

import {
  assertNonNull,
  assertActivityCompleted,
  isHttpClient,
  TActivityStatus,
  TActivityId,
  TSignature,
  TurnkeyActivityError as TurnkeyHttpActivityError,
  TurnkeyActivityConsensusNeededError as TurnkeyHttpActivityConsensusNeededError,
  TurnkeyClient,
} from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import type { TurnkeyBrowserClient } from "@turnkey/sdk-browser";
import type { TurnkeyServerClient } from "@turnkey/sdk-server";

export type TTurnkeyConsensusNeededErrorType = TurnkeyConsensusNeededError & {
  name: "TurnkeyConsensusNeededError";
};

export type TTurnkeyActivityErrorType = TurnkeyActivityError & {
  name: "TurnkeyActivityError";
};

type TSignAuthorizationParameters = Omit<
  SignAuthorizationParameters,
  "privateKey" // unnecessary as we are signing using Turnkey keys
>;

type TSignatureFormat = "object" | "bytes" | "hex";

type TSignatureExtended = Omit<TSignature, "v"> & {
  v: string | BigInt;
};

type TSignMessageResult = Uint8Array | Hex | TSignatureExtended;

export class TurnkeyConsensusNeededError extends BaseError {
  override name = "TurnkeyConsensusNeededError";

  activityId: TActivityId | undefined;
  activityStatus: TActivityStatus | undefined;

  constructor({
    message = "Turnkey activity requires consensus.",
    activityId,
    activityStatus,
  }: {
    message?: string | undefined;
    activityId: TActivityId | undefined;
    activityStatus: TActivityStatus | undefined;
  }) {
    super(message);
    this.activityId = activityId;
    this.activityStatus = activityStatus;
  }
}

export class TurnkeyActivityError extends BaseError {
  override name = "TurnkeyActivityError";

  activityId: TActivityId | undefined;
  activityStatus: TActivityStatus | undefined;

  constructor({
    message = "Received unexpected Turnkey activity status.",
    activityId,
    activityStatus,
  }: {
    message?: string | undefined;
    activityId?: TActivityId | undefined;
    activityStatus?: TActivityStatus | undefined;
  }) {
    super(message);
    this.activityId = activityId;
    this.activityStatus = activityStatus;
  }
}

export function createAccountWithAddress(input: {
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient;
  organizationId: string;
  // This can be a wallet account address, private key address, or private key ID.
  signWith: string;
  // Ethereum address to use for this account, in the case that a private key ID is used to sign.
  // Can be left undefined if signWith is a wallet account address.
  ethereumAddress?: string;
}): LocalAccount {
  const { client, organizationId, signWith } = input;
  let { ethereumAddress } = input;

  if (!signWith) {
    throw new TurnkeyHttpActivityError({
      message: `Missing signWith parameter`,
    });
  }

  if (isAddress(signWith)) {
    // override provided `ethereumAddress`
    ethereumAddress = signWith;
  } else if (!ethereumAddress) {
    throw new TurnkeyActivityError({
      message: `Missing ethereumAddress parameter`,
    });
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
      TTransactionSerializable extends TransactionSerializable,
    >(
      transaction: TTransactionSerializable,
      options?: {
        serializer?:
        | SerializeTransactionFn<TTransactionSerializable>
        | undefined;
      },
    ): Promise<Hex> {
      const serializer: SerializeTransactionFn<TTransactionSerializable> =
        options?.serializer ??
        (serializeTransaction as SerializeTransactionFn<TTransactionSerializable>);
      return signTransaction(
        client,
        transaction,
        serializer,
        organizationId,
        signWith,
      );
    },
    signTypedData: function (
      typedData: TypedData | { [key: string]: unknown },
    ): Promise<Hex> {
      return signTypedData(client, typedData, organizationId, signWith);
    },
    signAuthorization: function (
      parameters: TSignAuthorizationParameters,
    ): Promise<SignAuthorizationReturnType> {
      return signAuthorization(client, parameters, organizationId, signWith);
    },
  });
}

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
      (item: any) => item.format === "ADDRESS_FORMAT_ETHEREUM",
    )?.address;

    if (typeof ethereumAddress !== "string" || !ethereumAddress) {
      throw new TurnkeyActivityError({
        message: `Unable to find Ethereum address for key ${signWith} under organization ${organizationId}`,
      });
    }
  }

  return createAccountWithAddress({
    client,
    organizationId,
    signWith,
    ethereumAddress,
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
  config: TApiKeyAccountConfig,
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
    stamper,
  );

  const data = await client.getPrivateKey({
    privateKeyId: privateKeyId,
    organizationId: organizationId,
  });

  const ethereumAddress = data.privateKey.addresses.find(
    (item: any) => item.format === "ADDRESS_FORMAT_ETHEREUM",
  )?.address;

  if (typeof ethereumAddress !== "string" || !ethereumAddress) {
    throw new TurnkeyHttpActivityError({
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
      TTransactionSerializable extends TransactionSerializable,
    >(
      transaction: TTransactionSerializable,
      options?: {
        serializer?:
        | SerializeTransactionFn<TTransactionSerializable>
        | undefined;
      },
    ): Promise<Hex> {
      const serializer: SerializeTransactionFn<TTransactionSerializable> =
        options?.serializer ??
        (serializeTransaction as SerializeTransactionFn<TTransactionSerializable>);
      return signTransaction(
        client,
        transaction,
        serializer,
        organizationId,
        privateKeyId,
      );
    },
    signTypedData: function (
      typedData: TypedData | { [key: string]: unknown },
    ): Promise<Hex> {
      return signTypedData(client, typedData, organizationId, privateKeyId);
    },
    signAuthorization: function (
      parameters: TSignAuthorizationParameters,
    ): Promise<SignAuthorizationReturnType> {
      return signAuthorization(
        client,
        parameters,
        organizationId,
        privateKeyId,
      );
    },
  });
}

export async function signAuthorization(
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  parameters: TSignAuthorizationParameters,
  organizationId: string,
  signWith: string,
  timestampMs?: number,
): Promise<SignAuthorizationReturnType> {
  const { chainId, nonce, to = "object" } = parameters;
  const address = parameters.contractAddress ?? parameters.address;

  if (!address) {
    throw new TurnkeyActivityError({
      message: "Unable to sign authorization: address is undefined.",
    });
  }

  const hashedAuthorization = hashAuthorization({
    address: address,
    chainId,
    nonce,
  });

  const signature = await signMessageWithErrorWrapping(
    client,
    hashedAuthorization,
    organizationId,
    signWith,
    to,
    timestampMs,
  );

  if (to === "object")
    return {
      address,
      chainId,
      nonce,
      ...(signature as TSignature),
      yParity: (signature as TSignature).v,
    } as any;

  return signature as any;
}

export async function signMessage(
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  message: SignableMessage,
  organizationId: string,
  signWith: string,
  timestampMs?: number,
): Promise<Hex> {
  const hashedMessage = hashMessage(message);
  const signedMessage = await signMessageWithErrorWrapping(
    client,
    hashedMessage,
    organizationId,
    signWith,
    undefined,
    timestampMs,
  );
  return `${signedMessage}` as Hex;
}

export async function signTransaction<
  TTransactionSerializable extends TransactionSerializable,
>(
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  transaction: TTransactionSerializable,
  serializer: SerializeTransactionFn<TTransactionSerializable>,
  organizationId: string,
  signWith: string,
): Promise<Hex> {
  // Note: for Type 3 transactions, we are specifically handling parsing for payloads containing only the transaction payload body, without any wrappers around blobs, commitments, or proofs.
  // See more: https://github.com/wevm/viem/blob/3ef19eac4963014fb20124d1e46d1715bed5509f/src/accounts/utils/signTransaction.ts#L54-L55
  const signableTransaction =
    transaction.type === "eip4844"
      ? { ...transaction, sidecars: false }
      : transaction;

  const serializedTx = serializer(signableTransaction);
  const nonHexPrefixedSerializedTx = serializedTx.replace(/^0x/, "");
  const signedTx = await signTransactionWithErrorWrapping(
    client,
    nonHexPrefixedSerializedTx,
    organizationId,
    signWith,
  );

  if (transaction.type === "eip4844") {
    // Grab components of the signature
    const { r, s, v } = parseTransaction(signedTx);

    // Recombine with the original transaction
    return serializeTransaction(transaction, {
      r: r!,
      s: s!,
      v: v!,
    });
  }

  return signedTx;
}

export async function signTypedData(
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  data: TypedData | { [key: string]: unknown },
  organizationId: string,
  signWith: string,
  timestampMs?: number,
): Promise<Hex> {
  const hashToSign = hashTypedData(data as HashTypedDataParameters);

  return (await signMessageWithErrorWrapping(
    client,
    hashToSign,
    organizationId,
    signWith,
    "hex",
    timestampMs,
  )) as Hex;
}

async function signTransactionWithErrorWrapping(
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  unsignedTransaction: string,
  organizationId: string,
  signWith: string,
  timestampMs?: number
): Promise<Hex> {
  let signedTx: string;
  try {
    signedTx = await signTransactionImpl(
      client,
      unsignedTransaction,
      organizationId,
      signWith,
      timestampMs,
    );
  } catch (error: any) {
    // Wrap Turnkey error in Viem-specific error
    if (error instanceof TurnkeyHttpActivityError) {
      throw new TurnkeyActivityError({
        message: error.message,
        activityId: error.activityId,
        activityStatus: error.activityStatus,
      });
    }

    if (error instanceof TurnkeyHttpActivityConsensusNeededError) {
      throw new TurnkeyConsensusNeededError({
        message: error.message,
        activityId: error.activityId,
        activityStatus: error.activityStatus,
      });
    }

    throw new TurnkeyActivityError({
      message: `Failed to sign: ${(error as Error).message}`,
    });
  }

  return `0x${signedTx}`;
}

async function signTransactionImpl(
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  unsignedTransaction: string,
  organizationId: string,
  signWith: string,
  timestampMs?: number
): Promise<string> {
  if (isHttpClient(client)) {
    const { activity } = await client.signTransaction({
      type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
      organizationId: organizationId,
      parameters: {
        signWith,
        type: "TRANSACTION_TYPE_ETHEREUM",
        unsignedTransaction: unsignedTransaction,
      },
      timestampMs: timestampMs ? String(timestampMs) : String(Date.now()), // millisecond timestamp
    });

    assertActivityCompleted(activity);

    return assertNonNull(
      activity?.result?.signTransactionResult?.signedTransaction,
    );
  } else {
    const { activity, signedTransaction } = await client.signTransaction({
      organizationId,
      signWith,
      type: "TRANSACTION_TYPE_ETHEREUM",
      unsignedTransaction: unsignedTransaction,
    });

    assertActivityCompleted(activity);

    return assertNonNull(signedTransaction);
  }
}

async function signMessageWithErrorWrapping(
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  message: string,
  organizationId: string,
  signWith: string,
  to?: TSignatureFormat,
  timestampMs?: number,
): Promise<TSignMessageResult> {
  let signedMessage: TSignMessageResult;

  try {
    signedMessage = await signMessageImpl(
      client,
      message,
      organizationId,
      signWith,
      to,
      timestampMs,
    );
  } catch (error: any) {
    // Wrap Turnkey error in Viem-specific error
    if (error instanceof TurnkeyHttpActivityError) {
      throw new TurnkeyActivityError({
        message: error.message,
        activityId: error.activityId,
        activityStatus: error.activityStatus,
      });
    }

    if (error instanceof TurnkeyHttpActivityConsensusNeededError) {
      throw new TurnkeyConsensusNeededError({
        message: error.message,
        activityId: error.activityId,
        activityStatus: error.activityStatus,
      });
    }

    throw new TurnkeyActivityError({
      message: `Failed to sign: ${(error as Error).message}`,
    });
  }

  return signedMessage;
}

async function signMessageImpl(
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient,
  message: string,
  organizationId: string,
  signWith: string,
  to?: TSignatureFormat,
  timestampMs?: number,
): Promise<TSignMessageResult> {
  let result: TSignature;

  if (isHttpClient(client)) {
    const { activity } = await client.signRawPayload({
      type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
      organizationId: organizationId,
      parameters: {
        signWith,
        payload: message,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NO_OP",
      },
      timestampMs: timestampMs ? String(timestampMs) : String(Date.now()), // millisecond timestamp
    });

    assertActivityCompleted(activity);

    result = assertNonNull(activity?.result?.signRawPayloadResult);
  } else {
    const { activity, r, s, v } = await client.signRawPayload({
      organizationId,
      signWith,
      payload: message,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
    });

    assertActivityCompleted(activity);

    result = {
      r,
      s,
      v,
    };
  }

  if (to === "object") {
    return {
      r: `0x${result.r}`,
      s: `0x${result.s}`,
      v: BigInt(result.v),
    };
  }

  return assertNonNull(serializeSignature(result, to));
}

// Modified from Viem implementation:
// https://github.com/wevm/viem/blob/c8378d22f692f48edde100693159874702f36330/src/utils/signature/serializeSignature.ts#L38-L39
export function serializeSignature(
  sig: TSignature,
  to: TSignatureFormat = "hex",
) {
  const { r: rString, s: sString, v: vString } = sig;

  const r: `0x${string}` = `0x${rString}`;
  const s: `0x${string}` = `0x${sString}`;
  const v = BigInt(vString);

  // Turnkey's `v` returned can be used as a proxy for yParity
  const yParity_ = v;

  const signature = `0x${new secp256k1.Signature(
    hexToBigInt(r),
    hexToBigInt(s),
  ).toCompactHex()}${yParity_ === 0n ? "1b" : "1c"}` as const;

  if (to === "hex") return signature;
  return hexToBytes(signature);
}

export function isTurnkeyActivityConsensusNeededError(error: any) {
  return (
    typeof error.walk === "function" &&
    error.walk((e: any) => {
      return e instanceof TurnkeyConsensusNeededError;
    })
  );
}

export function isTurnkeyActivityError(error: any) {
  return (
    typeof error.walk === "function" &&
    error.walk((e: any) => {
      return e instanceof TurnkeyActivityError;
    })
  );
}
