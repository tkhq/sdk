import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  assertNonNull,
  assertActivityCompleted,
  TurnkeyClient,
  type TSignature,
} from "@turnkey/http";
import type { TurnkeyBrowserClient } from "@turnkey/sdk-browser";
import type { TurnkeyServerClient } from "@turnkey/sdk-server";

type TClient = TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient;

export class TurnkeySigner {
  public readonly organizationId: string;
  public readonly client: TClient;

  constructor(input: { organizationId: string; client: TClient }) {
    this.organizationId = input.organizationId;
    this.client = input.client;
  }

  /**
   * This function takes an array of Solana transactions and adds a signature with Turnkey to each of them
   *
   * @param txs array of Transaction | VersionedTransaction (native @solana/web3.js type)
   * @param fromAddress Solana address (base58 encoded)
   */
  public async signAllTransactions(
    signWithPayloads: {
      signWith: string;
      transactions: (Transaction | VersionedTransaction)[];
    }[],
    organizationId?: string
  ): Promise<
    {
      signWith: string;
      transactions: (Transaction | VersionedTransaction)[];
    }[]
  > {
    const signingPayloads: {
      signWith: string;
      payloads: string[];
    }[] = [];

    for (const p of signWithPayloads) {
      const messages = p.transactions.map((innerTx) =>
        this.getMessageToSign(innerTx).toString("hex")
      );

      signingPayloads.push({
        signWith: p.signWith,
        payloads: messages,
      });
    }

    const { signWithResults } = await this.signRawPayloads(
      signingPayloads,
      organizationId
    );

    const signedTxs: {
      signWith: string;
      transactions: (Transaction | VersionedTransaction)[];
    }[] = [];

    // Length of txs and signWithResults should be equivalent
    for (let i = 0; i < signWithResults.length; i++) {
      const signer = signWithResults[i]?.signWith;
      const fromKey = new PublicKey(signer!);
      const signatures = signWithResults[i]?.signatures?.map(
        (sig: TSignature) => `${sig?.r}${sig?.s}`
      );

      for (const tx of signWithPayloads[i]?.transactions!) {
        tx?.addSignature(fromKey, Buffer.from(signatures![i]!, "hex"));
      }

      signedTxs.push({
        signWith: signer!,
        transactions: signWithPayloads[i]?.transactions!,
      });
    }

    return signedTxs;
  }

  /**
   * This function takes a Solana transaction and adds a signature with Turnkey
   *
   * @param tx Transaction | VersionedTransaction object (native @solana/web3.js type)
   * @param fromAddress Solana address (base58 encoded)
   */
  public async addSignature(
    tx: Transaction | VersionedTransaction,
    fromAddress: string,
    organizationId?: string
  ) {
    const fromKey = new PublicKey(fromAddress);
    const messageToSign: Buffer = this.getMessageToSign(tx);
    const signRawPayloadResult = await this.signRawPayload(
      messageToSign.toString("hex"),
      fromAddress,
      organizationId ?? this.organizationId
    );
    const signature = `${signRawPayloadResult?.r}${signRawPayloadResult?.s}`;

    tx.addSignature(fromKey, Buffer.from(signature, "hex"));
  }

  /**
   * This function takes a message and returns it after being signed with Turnkey
   *
   * @param message The message to sign (Uint8Array)
   * @param fromAddress Solana address (base58 encoded)
   */
  public async signMessage(
    message: Uint8Array,
    fromAddress: string,
    organizationId?: string
  ): Promise<Uint8Array> {
    const signRawPayloadResult = await this.signRawPayload(
      Buffer.from(message).toString("hex"),
      fromAddress,
      organizationId
    );
    return Buffer.from(
      `${signRawPayloadResult?.r}${signRawPayloadResult?.s}`,
      "hex"
    );
  }

  /**
   * This function takes a Solana transaction, adds a signature via Turnkey,
   * and returns a new transaction
   *
   * @param tx Transaction | VersionedTransaction object (native @solana/web3.js type)
   * @param fromAddress Solana address (base58 encoded)
   */
  public async signTransaction(
    tx: Transaction | VersionedTransaction,
    fromAddress: string,
    organizationId?: string
  ): Promise<Transaction | VersionedTransaction> {
    const payloadToSign = Buffer.from(
      tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      })
    ).toString("hex");

    const signedTransaction = await this.signTransactionImpl(
      payloadToSign,
      fromAddress,
      organizationId
    );

    const decodedTransaction = Buffer.from(signedTransaction, "hex");

    const recoveredTransaction: Transaction | VersionedTransaction =
      "version" in tx
        ? VersionedTransaction.deserialize(decodedTransaction)
        : Transaction.from(decodedTransaction);

    return recoveredTransaction;
  }

  private async signTransactionImpl(
    unsignedTransaction: string,
    signWith: string,
    organizationId?: string
  ) {
    if (this.client instanceof TurnkeyClient) {
      const response = await this.client.signTransaction({
        type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
        organizationId: organizationId ?? this.organizationId,
        timestampMs: String(Date.now()),
        parameters: {
          signWith,
          unsignedTransaction,
          type: "TRANSACTION_TYPE_SOLANA",
        },
      });

      const { activity } = response;

      assertActivityCompleted(activity);

      return assertNonNull(
        activity?.result?.signTransactionResult?.signedTransaction
      );
    } else {
      const { activity, signedTransaction } = await this.client.signTransaction(
        {
          ...(organizationId !== undefined && { organizationId }),
          signWith,
          unsignedTransaction,
          type: "TRANSACTION_TYPE_SOLANA",
        }
      );

      assertActivityCompleted(activity);

      return assertNonNull(signedTransaction);
    }
  }

  private async signRawPayload(
    payload: string,
    signWith: string,
    organizationId?: string
  ) {
    if (this.client instanceof TurnkeyClient) {
      const response = await this.client.signRawPayload({
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
        organizationId: organizationId ?? this.organizationId,
        timestampMs: String(Date.now()),
        parameters: {
          signWith,
          payload,
          encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
          // Note: unlike ECDSA, EdDSA's API does not support signing raw digests (see RFC 8032).
          // Turnkey's signer requires an explicit value to be passed here to minimize ambiguity.
          hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
        },
      });

      const { activity } = response;

      assertActivityCompleted(activity);

      return assertNonNull(activity?.result?.signRawPayloadResult);
    } else {
      const { activity, r, s, v } = await this.client.signRawPayload({
        ...(organizationId !== undefined && { organizationId }),
        signWith,
        payload,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        // Note: unlike ECDSA, EdDSA's API does not support signing raw digests (see RFC 8032).
        // Turnkey's signer requires an explicit value to be passed here to minimize ambiguity.
        hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      });

      assertActivityCompleted(activity);

      return assertNonNull({
        r,
        s,
        v,
      });
    }
  }

  private async signRawPayloads(
    signWithPayloads: {
      signWith: string;
      payloads: string[];
    }[],
    organizationId?: string
  ) {
    if (this.client instanceof TurnkeyClient) {
      const response = await this.client.signRawPayloads({
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOADS_V2",
        organizationId: organizationId ?? this.organizationId,
        timestampMs: String(Date.now()),
        parameters: {
          signWithPayloads,
          encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
          // Note: unlike ECDSA, EdDSA's API does not support signing raw digests (see RFC 8032).
          // Turnkey's signer requires an explicit value to be passed here to minimize ambiguity.
          hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
        },
      });

      const { activity } = response;

      assertActivityCompleted(activity);

      return assertNonNull(activity?.result?.signRawPayloadsResultV2);
    } else {
      const { activity, signWithResults } = await this.client.signRawPayloads({
        ...(organizationId !== undefined && { organizationId }),
        signWithPayloads,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        // Note: unlike ECDSA, EdDSA's API does not support signing raw digests (see RFC 8032).
        // Turnkey's signer requires an explicit value to be passed here to minimize ambiguity.
        hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      });

      assertActivityCompleted(activity);

      return assertNonNull({
        signWithResults,
      });
    }
  }

  private getMessageToSign(tx: Transaction | VersionedTransaction): Buffer {
    let messageToSign: Buffer;

    // @ts-ignore
    // type narrowing (e.g. tx instanceof Transaction) does not seem to work here when the package gets compiled
    // and bundled. Instead, we will check for the existence of a property unique to the Transaction class
    // to determine whether the caller passed a Transaction or a VersionedTransaction
    if (typeof tx.serializeMessage === "function") {
      messageToSign = (tx as Transaction).serializeMessage();
    } else {
      messageToSign = Buffer.from(
        (tx as VersionedTransaction).message.serialize()
      );
    }

    return messageToSign;
  }
}
