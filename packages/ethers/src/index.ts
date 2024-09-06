import {
  Signature,
  Transaction,
  TransactionLike,
  TransactionRequest,
  hashMessage,
  resolveProperties,
  ethers,
  copyRequest,
  resolveAddress,
} from "ethers";
import { TurnkeyActivityError, TurnkeyRequestError } from "@turnkey/http";
import { TurnkeyClient } from "@turnkey/http";
import type { TurnkeyBrowserClient } from "@turnkey/sdk-browser";
import type { TurnkeyServerClient, TurnkeyApiTypes } from "@turnkey/sdk-server";
import {
  type TypedDataDomain,
  type TypedDataField,
  type Provider,
  AbstractSigner,
  isAddress,
  getAddress,
  TypedDataEncoder,
} from "ethers";

type TConfig = {
  /**
   * Turnkey client
   */
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient;
  /**
   * Turnkey organization ID
   */
  organizationId: string;
  /**
   * Turnkey wallet account address, private key address, or private key ID
   */
  signWith: string;
};

type TSignature = TurnkeyApiTypes["v1SignRawPayloadResult"];

export class TurnkeySigner extends AbstractSigner implements ethers.Signer {
  private readonly client:
    | TurnkeyClient
    | TurnkeyBrowserClient
    | TurnkeyServerClient;

  public readonly organizationId: string;
  public readonly signWith: string;

  constructor(config: TConfig, provider?: Provider) {
    super(provider);

    this.client = config.client;
    this.organizationId = config.organizationId;
    this.signWith = config.signWith;
  }

  connect(provider: Provider): TurnkeySigner {
    return new TurnkeySigner(
      {
        client: this.client,
        organizationId: this.organizationId,
        signWith: this.signWith,
      },
      provider
    );
  }

  // If the configured `signWith` is an Ethereum address, use it.
  // Otherwise, if it's a Turnkey Private Key ID, fetch the corresponding
  // private key's address.
  async getAddress(): Promise<string> {
    let ethereumAddress;

    if (!this.signWith) {
      throw new TurnkeyActivityError({
        message: `Missing signWith parameter`,
      });
    }

    if (isAddress(this.signWith)) {
      ethereumAddress = this.signWith;
    } else if (!ethereumAddress) {
      const data = await this.client.getPrivateKey({
        privateKeyId: this.signWith,
        organizationId: this.organizationId,
      });

      ethereumAddress = data.privateKey.addresses.find(
        (item: any) => item.format === "ADDRESS_FORMAT_ETHEREUM"
      )?.address;

      if (typeof ethereumAddress !== "string" || !ethereumAddress) {
        throw new TurnkeyActivityError({
          message: `Unable to find Ethereum address for key ${this.signWith} under organization ${this.organizationId}`,
        });
      }
    }

    return ethereumAddress;
  }

  private async _signTransactionImpl(
    unsignedTransaction: string
  ): Promise<string> {
    if (this.client instanceof TurnkeyClient) {
      const { activity } = await this.client.signTransaction({
        type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
        organizationId: this.organizationId,
        parameters: {
          signWith: this.signWith,
          type: "TRANSACTION_TYPE_ETHEREUM",
          unsignedTransaction,
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
    } else {
      const { activity, signedTransaction } = await this.client.signTransaction(
        {
          signWith: this.signWith,
          type: "TRANSACTION_TYPE_ETHEREUM",
          unsignedTransaction,
        }
      );

      if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
        throw new TurnkeyActivityError({
          message: `Unexpected activity status: ${activity.status}`,
          activityId: activity.id,
          activityStatus:
            activity.status as TurnkeyApiTypes["v1ActivityStatus"],
        });
      }

      return assertNonNull(signedTransaction);
    }
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

  async signTransaction(transaction: TransactionRequest): Promise<string> {
    let { from, to, ...txn } = copyRequest(transaction);
    ({ to, from } = await resolveProperties({
      to: transaction.to
        ? resolveAddress(transaction.to, this.provider)
        : undefined,
      from: transaction.from
        ? resolveAddress(transaction.from, this.provider)
        : undefined,
    }));

    // Mimic the behavior of ethers' `Wallet`:
    // - You don't need to pass in `tx.from`
    // - However if you do provide `tx.from`, verify and drop it before serialization
    //
    // https://github.com/ethers-io/ethers.js/blob/f97b92bbb1bde22fcc44100af78d7f31602863ab/packages/wallet/src.ts/index.ts#L117-L121
    if (from != null) {
      const selfAddress = await this.getAddress();
      if (getAddress(from) !== selfAddress) {
        throw new Error(
          `Transaction \`tx.from\` address mismatch. Self address: ${selfAddress}; \`tx.from\` address: ${from}`
        );
      }
    }
    delete transaction.from;

    const tx = Transaction.from(<TransactionLike<string>>{
      ...txn,
      ...(to && { to }),
    });
    const unsignedTx = tx.unsignedSerialized.substring(2);
    const signedTx = await this._signTransactionWithErrorWrapping(unsignedTx);

    return `0x${signedTx}`;
  }

  // Returns the signed prefixed-message. Per Ethers spec, this method treats:
  // - Bytes as a binary message
  // - string as a UTF8-message
  // i.e. "0x1234" is a SIX (6) byte string, NOT 2 bytes of data
  async signMessage(message: string | Uint8Array): Promise<string> {
    const hashedMessage = hashMessage(message);
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
    let result;

    if (this.client instanceof TurnkeyClient) {
      const { activity } = await this.client.signRawPayload({
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
        organizationId: this.organizationId,
        parameters: {
          signWith: this.signWith,
          payload: message,
          encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
          hashFunction: "HASH_FUNCTION_NO_OP",
        },
        timestampMs: String(Date.now()), // millisecond timestamp
      });

      const { id, status, type } = activity;

      if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
        throw new TurnkeyActivityError({
          message: `Unexpected activity status: ${activity.status}`,
          activityId: id,
          activityStatus: status,
          activityType: type,
        });
      }

      result = assertNonNull(activity?.result?.signRawPayloadResult);
    } else {
      const { activity, r, s, v } = await this.client.signRawPayload({
        signWith: this.signWith,
        payload: message,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NO_OP",
      });

      if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
        throw new TurnkeyActivityError({
          message: `Unexpected activity status: ${activity.status}`,
          activityId: activity.id,
          activityStatus:
            activity.status as TurnkeyApiTypes["v1ActivityStatus"],
        });
      }

      result = {
        r,
        s,
        v,
      };
    }

    // Assemble the hex
    const assembled = Signature.from({
      r: `0x${result!.r}`,
      s: `0x${result!.s}`,
      v: parseInt(result!.v) + 27,
    }).serialized;

    return assertNonNull(assembled);
  }

  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    value: Record<string, any>
  ): Promise<string> {
    const populated = await TypedDataEncoder.resolveNames(
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
      TypedDataEncoder.hash(populated.domain, types, populated.value)
    );
  }

  _signTypedData = this.signTypedData.bind(this);

  /**
   * This function is a helper method to easily extract a signature string from a completed signing activity.
   * Particularly useful for scenarios where a signature requires consensus
   *
   * @param activityId the signing activity
   * @return signature (r, s, v)
   */
  public async getSignatureFromActivity(
    activityId: string
  ): Promise<TSignature> {
    const { activity } = await this.client.getActivity({
      organizationId: this.organizationId,
      activityId,
    });

    if (
      ![
        "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD",
        "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
      ].includes(activity.type)
    ) {
      throw new TurnkeyActivityError({
        message: `Unexpected activity type: ${activity.type}`,
        activityId: activity.id,
        activityStatus: activity.status as TurnkeyApiTypes["v1ActivityStatus"],
      });
    }

    if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
      throw new TurnkeyActivityError({
        message: `Activity is not yet completed: ${activity.status}`,
        activityId: activity.id,
        activityStatus: activity.status as TurnkeyApiTypes["v1ActivityStatus"],
      });
    }

    const signature = activity.result?.signRawPayloadResult!;

    return assertNonNull(signature);
  }

  /**
   * This function is a helper method to easily extract a signed transaction from a completed signing activity.
   * Particularly useful for scenarios where a signature requires consensus
   *
   * @param activityId the signing activity
   * @return signed transaction string
   */
  public async getSignedTransactionFromActivity(
    activityId: string
  ): Promise<string> {
    const { activity } = await this.client.getActivity({
      organizationId: this.organizationId,
      activityId,
    });

    if (
      ![
        "ACTIVITY_TYPE_SIGN_TRANSACTION",
        "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
      ].includes(activity.type)
    ) {
      throw new TurnkeyActivityError({
        message: `Unexpected activity type: ${activity.type}`,
        activityId: activity.id,
        activityStatus: activity.status as TurnkeyApiTypes["v1ActivityStatus"],
      });
    }

    if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
      throw new TurnkeyActivityError({
        message: `Activity is not yet completed: ${activity.status}`,
        activityId: activity.id,
        activityStatus: activity.status as TurnkeyApiTypes["v1ActivityStatus"],
      });
    }

    const { signedTransaction } = activity.result?.signTransactionResult!;

    return assertNonNull(`0x${signedTransaction}`);
  }
}

export { TurnkeyActivityError, TurnkeyRequestError };

function assertNonNull<T>(input: T | null | undefined): T {
  if (input == null) {
    throw new Error(`Got unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
