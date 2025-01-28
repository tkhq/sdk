import {
  type TypedDataDomain,
  type TypedDataField,
  type Provider,
  AbstractSigner,
  isAddress,
  getAddress,
  TypedDataEncoder,
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
import {
  TurnkeyClient,
  TurnkeyActivityError,
  TurnkeyRequestError,
  TurnkeyActivityConsensusNeededError,
  assertActivityCompleted,
  assertNonNull,
  type TSignature,
} from "@turnkey/http";
import type { TurnkeyBrowserClient } from "@turnkey/sdk-browser";
import type { TurnkeyServerClient } from "@turnkey/sdk-server";

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

      assertActivityCompleted(activity);

      return assertNonNull(
        activity?.result?.signTransactionResult?.signedTransaction
      );
    } else {
      const { activity, signedTransaction } = await this.client.signTransaction(
        {
          signWith: this.signWith,
          type: "TRANSACTION_TYPE_ETHEREUM",
          unsignedTransaction,
        }
      );

      assertActivityCompleted(activity);

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
      if (
        error instanceof TurnkeyActivityError ||
        error instanceof TurnkeyActivityConsensusNeededError
      ) {
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
      if (
        error instanceof TurnkeyActivityError ||
        error instanceof TurnkeyActivityConsensusNeededError
      ) {
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

      assertActivityCompleted(activity);

      result = assertNonNull(activity?.result?.signRawPayloadResult);
    } else {
      const { activity, r, s, v } = await this.client.signRawPayload({
        signWith: this.signWith,
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

    return serializeSignature(result);
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
}

export function serializeSignature(signature: TSignature) {
  const assembled = Signature.from({
    r: `0x${signature.r}`,
    s: `0x${signature.s}`,
    v: parseInt(signature.v) + 27,
  }).serialized;

  return assertNonNull(assembled);
}

export { TurnkeyActivityError, TurnkeyRequestError };
