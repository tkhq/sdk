import { ethers, type UnsignedTransaction, type Bytes } from "ethers";
import { PublicApiService, init as httpInit } from "@turnkey/http";

type TActivity = PublicApiService.TPostGetActivityResponse["activity"];
type TActivityId = TActivity["id"];
type TActivityStatus = TActivity["status"];
type TActivityType = TActivity["type"];

export class TurnkeyActivityError extends Error {
  activityId: TActivityId | null;
  activityStatus: TActivityStatus | null;
  activityType: TActivityType | null;
  cause: Error | null;

  constructor(input: {
    message: string;
    cause?: Error | null;
    activityId?: TActivityId | null;
    activityStatus?: TActivityStatus | null;
    activityType?: TActivityType | null;
  }) {
    const { message, cause, activityId, activityStatus, activityType } = input;
    super(message);

    this.name = "TurnkeyActivityError";
    this.activityId = activityId ?? null;
    this.activityStatus = activityStatus ?? null;
    this.activityType = activityType ?? null;
    this.cause = cause ?? null;
  }
}

type TConfig = {
  apiPublicKey: string;
  apiPrivateKey: string;
  baseUrl: string;
  organizationId: string;
  privateKeyId: string;
};

export class TurnkeySigner extends ethers.Signer {
  private readonly config: TConfig;

  public readonly organizationId: string;
  public readonly privateKeyId: string;

  constructor(config: TConfig, provider?: ethers.providers.Provider) {
    super();

    ethers.utils.defineReadOnly(this, "provider", provider);
    this.config = config;

    const {
      apiPublicKey,
      apiPrivateKey,
      baseUrl,
      organizationId,
      privateKeyId,
    } = config;

    this.organizationId = organizationId;
    this.privateKeyId = privateKeyId;

    httpInit({
      apiPublicKey,
      apiPrivateKey,
      baseUrl,
    });
  }

  connect(provider: ethers.providers.Provider): TurnkeySigner {
    return new TurnkeySigner(this.config, provider);
  }

  async getAddress(): Promise<string> {
    const data = await PublicApiService.postGetPrivateKey({
      body: {
        privateKeyId: this.config.privateKeyId,
        organizationId: this.config.organizationId,
      },
    });

    const maybeAddress = data.privateKey.addresses.find(
      (item) => item.format === "ADDRESS_FORMAT_ETHEREUM"
    )?.address;

    if (typeof maybeAddress !== "string" || !maybeAddress) {
      throw new TurnkeyActivityError({
        message: `Unable to find Ethereum address for key ${this.config.privateKeyId} under organization ${this.config.organizationId}`,
      });
    }

    return maybeAddress;
  }

  private async _signTransactionImpl(message: string): Promise<string> {
    const { activity } = await PublicApiService.postSignTransaction({
      body: {
        type: "ACTIVITY_TYPE_SIGN_TRANSACTION",
        organizationId: this.config.organizationId,
        parameters: {
          privateKeyId: this.config.privateKeyId,
          type: "TRANSACTION_TYPE_ETHEREUM",
          unsignedTransaction: message,
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

  private async _signTransactionWithErrorWrapping(
    message: string
  ): Promise<string> {
    let signedTx: string;
    try {
      signedTx = await this._signTransactionImpl(message);
    } catch (error) {
      if (error instanceof TurnkeyActivityError) {
        throw error;
      }

      throw new TurnkeyActivityError({
        message: `Failed to sign`,
        cause: error as Error,
      });
    }

    return signedTx;
  }

  async signTransaction(
    transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>
  ): Promise<string> {
    const unsignedTx = await ethers.utils.resolveProperties(transaction);
    const serializedTx = ethers.utils.serializeTransaction(
      unsignedTx as UnsignedTransaction
    );
    const nonHexPrefixedSerializedTx = serializedTx.replace(/^0x/, "");
    const signedTx = await this._signTransactionWithErrorWrapping(
      nonHexPrefixedSerializedTx
    );
    return `0x${signedTx}`;
  }

  // Returns the signed prefixed-message. Per Ethers spec, this method treats:
  // - Bytes as a binary message
  // - string as a UTF8-message
  // i.e. "0x1234" is a SIX (6) byte string, NOT 2 bytes of data
  async signMessage(message: string | Bytes): Promise<string> {
    const hashedMessage = ethers.utils.hashMessage(message);
    const signedMessage = await this._signMessageWithErrorWrapping(
      hashedMessage
    );
    return `${signedMessage}`;
  }

  async _signMessageWithErrorWrapping(message: string): Promise<string> {
    let signedMessage: string;
    try {
      signedMessage = await this._signMessageImpl(message);
    } catch (error) {
      if (error instanceof TurnkeyActivityError) {
        throw error;
      }

      throw new TurnkeyActivityError({
        message: `Failed to sign`,
        cause: error as Error,
      });
    }

    return signedMessage;
  }

  async _signMessageImpl(message: string): Promise<string> {
    const { activity } = await PublicApiService.postSignRawPayload({
      body: {
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD",
        organizationId: this.config.organizationId,
        parameters: {
          privateKeyId: this.config.privateKeyId,
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

      let assembled = ethers.utils.joinSignature({
        r: `0x${result.r}`,
        s: `0x${result.s}`,
        v: parseInt(result.v) + 27,
      });

      // assemble the hex
      return assertNonNull(assembled);
    }

    throw new TurnkeyActivityError({
      message: `Invalid activity status: ${activity.status}`,
      activityId: id,
      activityStatus: status,
      activityType: type,
    });
  }
}

export function assertNonNull<T>(input: T | null | undefined): T {
  if (input == null) {
    throw new Error(`Got unexpected ${JSON.stringify(input)}`);
  }

  return input;
}

export function assertNever(input: never, message?: string): never {
  throw new Error(
    message != null ? message : `Unexpected case: ${JSON.stringify(input)}`
  );
}
