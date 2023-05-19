import { ethers } from "ethers";
import {
  TurnkeyApi,
  TurnkeyActivityError,
  TurnkeyRequestError,
  init as httpInit,
} from "@turnkey/http";
import type { TypedDataSigner } from "@ethersproject/abstract-signer";
import type {
  UnsignedTransaction,
  Bytes,
  TypedDataDomain,
  TypedDataField,
} from "ethers";

type TConfig = {
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

export class TurnkeySigner extends ethers.Signer implements TypedDataSigner {
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
    const data = await TurnkeyApi.postGetPrivateKey({
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
    const { activity } = await TurnkeyApi.postSignTransaction({
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
        message: `Failed to sign: ${(error as Error).message}`,
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
        message: `Failed to sign: ${(error as Error).message}`,
        cause: error as Error,
      });
    }

    return signedMessage;
  }

  async _signMessageImpl(message: string): Promise<string> {
    const { activity } = await TurnkeyApi.postSignRawPayload({
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

  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    value: Record<string, any>
  ): Promise<string> {
    // Populate any ENS names
    const populated = await ethers.utils._TypedDataEncoder.resolveNames(
      domain,
      types,
      value,
      async (name: string) => {
        assertNonNull(this.provider);

        const address = await this.provider?.resolveName(name);
        assertNonNull(address);

        return address ?? "";
      }
    );

    return this._signMessageWithErrorWrapping(
      ethers.utils._TypedDataEncoder.hash(
        populated.domain,
        types,
        populated.value
      )
    );
  }

  _signTypedData = this.signTypedData.bind(this);
}

export { TurnkeyActivityError, TurnkeyRequestError };

function assertNonNull<T>(input: T | null | undefined): T {
  if (input == null) {
    throw new Error(`Got unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
