import {
  PublicKey,
  type Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import { TurnkeyActivityError, TurnkeyClient } from "@turnkey/http";

export class TurnkeySigner {
  public readonly organizationId: string;
  public readonly client: TurnkeyClient;

  constructor(input: { organizationId: string; client: TurnkeyClient }) {
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
    txs: (Transaction | VersionedTransaction)[],
    fromAddress: string
  ): Promise<(Transaction | VersionedTransaction)[]> {
    const fromKey = new PublicKey(fromAddress);

    let messages = txs.map((tx) => this.getMessageToSign(tx).toString("hex"));

    const signRawPayloadsResult = await this.signRawPayloads(
      messages,
      fromAddress
    );

    const signatures =
      signRawPayloadsResult.signRawPayloadsResult?.signatures?.map(
        (sig) => `${sig?.r}${sig?.s}`
      );

    for (let i in txs) {
      txs[i]?.addSignature(fromKey, Buffer.from(signatures![i]!, "hex"));
    }

    return txs;
  }

  /**
   * This function takes a Solana transaction and adds a signature with Turnkey
   *
   * @param tx Transaction | VersionedTransaction object (native @solana/web3.js type)
   * @param fromAddress Solana address (base58 encoded)
   */
  public async addSignature(
    tx: Transaction | VersionedTransaction,
    fromAddress: string
  ) {
    const fromKey = new PublicKey(fromAddress);

    let messageToSign: Buffer = this.getMessageToSign(tx);

    const signRawPayloadResult = await this.signRawPayload(
      messageToSign.toString("hex"),
      fromAddress
    );

    const signature = `${signRawPayloadResult.signRawPayloadResult?.r}${signRawPayloadResult.signRawPayloadResult?.s}`;

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
    fromAddress: string
  ): Promise<Uint8Array> {
    const signRawPayloadResult = await this.signRawPayload(
      Buffer.from(message).toString("hex"),
      fromAddress
    );
    return Buffer.from(
      `${signRawPayloadResult.signRawPayloadResult?.r}${signRawPayloadResult.signRawPayloadResult?.s}`,
      "hex"
    );
  }

  private async signRawPayload(payload: string, signWith: string) {
    const response = await this.client.signRawPayload({
      type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
      organizationId: this.organizationId,
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

    const { id, status, type, result } = response.activity;

    if (status !== "ACTIVITY_STATUS_COMPLETED") {
      throw new TurnkeyActivityError({
        message: `Expected COMPLETED status, got ${status}`,
        activityId: id,
        activityStatus: status,
        activityType: type,
      });
    }

    return result;
  }

  private async signRawPayloads(payloads: string[], signWith: string) {
    const response = await this.client.signRawPayloads({
      type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOADS",
      organizationId: this.organizationId,
      timestampMs: String(Date.now()),
      parameters: {
        signWith,
        payloads,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        // Note: unlike ECDSA, EdDSA's API does not support signing raw digests (see RFC 8032).
        // Turnkey's signer requires an explicit value to be passed here to minimize ambiguity.
        hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      },
    });

    const { id, status, type, result } = response.activity;

    if (status !== "ACTIVITY_STATUS_COMPLETED") {
      throw new TurnkeyActivityError({
        message: `Expected COMPLETED status, got ${status}`,
        activityId: id,
        activityStatus: status,
        activityType: type,
      });
    }

    return result;
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
