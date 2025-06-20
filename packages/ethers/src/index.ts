import {
  type TypedDataDomain,
  type TypedDataField,
  type Provider,
  type Authorization as SignAuthorizationReturnType,
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
  isHttpClient,
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

// Custom types for EIP-7702 compliance
interface TSignAuthorizationParameters {
  address: string;
  chainId: number | bigint | string;
  nonce: number | bigint | string;
  code?: string;
}

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

  async signRawHash(hash: string): Promise<string> {
    try {
      return await this.signRawPayload({
        signWith: this.signWith,
        payload: hash,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL" as const,
        hashFunction: "HASH_FUNCTION_NO_OP" as const,
      });
    } catch (error) {
      throw new TurnkeyActivityError({
        message: `Failed to sign raw hash: ${error instanceof Error ? error.message : String(error)}`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  connect(provider: Provider): TurnkeySigner {
    return new TurnkeySigner(
      {
        client: this.client,
        organizationId: this.organizationId,
        signWith: this.signWith,
      },
      provider,
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
        (item: any) => item.format === "ADDRESS_FORMAT_ETHEREUM",
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
    unsignedTransaction: string,
  ): Promise<string> {
    if (isHttpClient(this.client)) {
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
        activity?.result?.signTransactionResult?.signedTransaction,
      );
    } else {
      const { activity, signedTransaction } = await this.client.signTransaction(
        {
          signWith: this.signWith,
          type: "TRANSACTION_TYPE_ETHEREUM",
          unsignedTransaction,
        },
      );

      assertActivityCompleted(activity);

      return assertNonNull(signedTransaction);
    }
  }

  private async _signTransactionWithErrorWrapping(
    message: string,
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
          `Transaction \`tx.from\` address mismatch. Self address: ${selfAddress}; \`tx.from\` address: ${from}`,
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
    const signedMessage =
      await this._signMessageWithErrorWrapping(hashedMessage);
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
    try {
      if (isHttpClient(this.client)) {
        const { activity } = await this.client.signRawPayload({
          type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
          organizationId: this.organizationId,
          parameters: {
            signWith: this.signWith,
            payload: message,
            encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
            hashFunction: "HASH_FUNCTION_NO_OP",
          },
          timestampMs: String(Date.now()),
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
        result = { r, s, v };
      }
      return serializeSignature(result);
    } catch (error) {
      throw new TurnkeyActivityError({
        message: `Failed to sign raw payload: ${error instanceof Error ? error.message : String(error)}`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    value: Record<string, any>,
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
      },
    );

    return this._signMessageWithErrorWrapping(
      TypedDataEncoder.hash(populated.domain, types, populated.value),
    );
  }

  _signTypedData = this.signTypedData.bind(this);

  async signAuthorization(
    parameters: TSignAuthorizationParameters,
  ): Promise<SignAuthorizationReturnType> {
    try {
      const { address, chainId, nonce, code = "0x" } = parameters;

      if (!isAddress(address)) {
        throw new TurnkeyActivityError({
          message: `Invalid Ethereum address: ${address}`,
        });
      }
      const normalizedAddress = getAddress(address);

      if (
        typeof chainId !== "number" &&
        typeof chainId !== "bigint" &&
        (typeof chainId !== "string" || isNaN(parseInt(chainId)))
      ) {
        throw new TurnkeyActivityError({
          message: `Invalid chainId: ${chainId}`,
        });
      }
      const normalizedChainId =
        typeof chainId === "bigint" ? chainId : BigInt(chainId);

      if (
        typeof nonce !== "number" &&
        typeof nonce !== "bigint" &&
        (typeof nonce !== "string" || isNaN(parseInt(nonce)))
      ) {
        throw new TurnkeyActivityError({
          message: `Invalid nonce: ${nonce}`,
        });
      }
      const normalizedNonce = typeof nonce === "bigint" ? nonce : BigInt(nonce);

      if (typeof code !== "string" || !code.match(/^0x[0-9a-fA-F]*$/)) {
        throw new TurnkeyActivityError({
          message: `Invalid code: ${code}`,
        });
      }

      // Validate chainId against provider
      if (this.provider) {
        const network = await this.provider.getNetwork();
        if (BigInt(network.chainId) !== normalizedChainId) {
          throw new TurnkeyActivityError({
            message: `chainId mismatch: expected ${network.chainId}, got ${normalizedChainId}`,
          });
        }
      }

      // Define EIP-712 structure
      const domain: TypedDataDomain = {
        name: "EIP7702Authorization",
        version: "1",
        chainId: normalizedChainId,
        verifyingContract: "0x0000000000000000000000000000000000000000",
      };
      const types: Record<string, Array<TypedDataField>> = {
        Authorization: [
          { name: "contract", type: "address" },
          { name: "chainId", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "code", type: "bytes" },
        ],
      };
      const message = {
        contract: normalizedAddress,
        chainId: normalizedChainId,
        nonce: normalizedNonce,
        code,
      };

      // Compute EIP-712 hash
      const authHash = TypedDataEncoder.hash(domain, types, message);

      // Sign the hash using Turnkey
      const signatureString = await this.signRawPayload({
        signWith: this.signWith,
        payload: authHash,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL" as const,
        hashFunction: "HASH_FUNCTION_NO_OP" as const,
      });

      // Verify the signature
      const recoveredAddress = ethers.verifyTypedData(
        domain,
        types,
        message,
        signatureString,
      );
      const expectedAddress = await this.getAddress();

      if (getAddress(recoveredAddress) !== getAddress(expectedAddress)) {
        throw new TurnkeyActivityError({
          message: `Signature verification failed: recovered address ${recoveredAddress} does not match signer ${expectedAddress}`,
        });
      }

      // Verify with hashAuthorization for comparison
      ethers.hashAuthorization({
        address: normalizedAddress,
        chainId: normalizedChainId,
        nonce: normalizedNonce,
        code,
      } as ethers.AuthorizationRequest);

      return {
        address: normalizedAddress,
        chainId: normalizedChainId,
        nonce: normalizedNonce,
        signature: Signature.from(signatureString),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCause =
        error instanceof Error
          ? error
          : error !== undefined
            ? new Error(String(error))
            : undefined;
      throw new TurnkeyActivityError({
        message: `Failed to sign authorization: ${errorMessage}`,
        cause: errorCause,
      });
    }
  }

  async signRawPayload(params: {
    signWith: string;
    payload: string;
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL" | "PAYLOAD_ENCODING_TEXT_UTF8";
    hashFunction:
      | "HASH_FUNCTION_NO_OP"
      | "HASH_FUNCTION_SHA256"
      | "HASH_FUNCTION_KECCAK256"
      | "HASH_FUNCTION_NOT_APPLICABLE";
  }): Promise<string> {
    let signResult: any;
    try {
      if (isHttpClient(this.client)) {
        const result = await this.client.signRawPayload({
          type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
          organizationId: this.organizationId,
          parameters: {
            signWith: params.signWith,
            payload: params.payload,
            encoding: params.encoding,
            hashFunction: params.hashFunction,
          },
          timestampMs: String(Date.now()),
        });

        assertActivityCompleted(result.activity);
        signResult = assertNonNull(result.activity.result.signRawPayloadResult);
      } else {
        const { activity, r, s, v } = await this.client.signRawPayload({
          signWith: params.signWith,
          payload: params.payload,
          encoding: params.encoding,
          hashFunction: params.hashFunction,
        });

        assertActivityCompleted(activity);
        signResult = { r, s, v };
      }
      return serializeSignature(signResult);
    } catch (error) {
      throw new TurnkeyActivityError({
        message: `Turnkey signRawPayload failed: ${error instanceof Error ? error.message : String(error)}`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}

export function serializeSignature(signature: TSignature) {
  if (!signature.r || !signature.s || !signature.v) {
    throw new TurnkeyActivityError({
      message: "Invalid signature format: missing r, s, or v",
    });
  }

  const vNum = parseInt(signature.v);
  if (vNum !== 0 && vNum !== 1) {
    throw new TurnkeyActivityError({
      message: `Invalid v value: ${signature.v}`,
    });
  }

  const assembled = Signature.from({
    r: `0x${signature.r}`,
    s: `0x${signature.s}`,
    v: vNum + 27,
  }).serialized;

  return assertNonNull(assembled);
}

export { TurnkeyActivityError, TurnkeyRequestError };
