import {
  PublicKey,
  type Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import { TurnkeyActivityError, TurnkeyClient } from "@turnkey/http";
import type { TurnkeyBrowserClient } from "@turnkey/sdk-browser";
import type { TurnkeyServerClient, TurnkeyApiTypes } from "@turnkey/sdk-server";

type TClient = TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient;

type TSignature = TurnkeyApiTypes["v1SignRawPayloadResult"];

type TActivityStatus = TurnkeyApiTypes["v1ActivityStatus"];


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
    txs: (Transaction | VersionedTransaction)[],
    fromAddress: string
  ): Promise<(Transaction | VersionedTransaction)[]> {
    const fromKey = new PublicKey(fromAddress);

    let messages = txs.map((tx) => this.getMessageToSign(tx).toString("hex"));

    const signRawPayloadsResult = await this.signRawPayloads(
      messages,
      fromAddress
    );

    const signatures = signRawPayloadsResult?.signatures?.map(
      (sig: TSignature) => `${sig?.r}${sig?.s}`
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
    fromAddress: string
  ): Promise<Uint8Array> {
    const signRawPayloadResult = await this.signRawPayload(
      Buffer.from(message).toString("hex"),
      fromAddress
    );
    return Buffer.from(
      `${signRawPayloadResult?.r}${signRawPayloadResult?.s}`,
      "hex"
    );
  }

  /**
   * This function is a helper method to easily extract a signature string from a completed signing activity.
   * Particularly useful for scenarios where a signature requires consensus.
   * This can be used in conjunction with `addSignature()` and `signMessage()` methods included in this SDK.
   * The resulting signature can be added to a transaction via `tx.addSignature(fromKey, Buffer.from(signature), "hex"))`
   *
   * @param activityId the signing activity
   * @return signature string. Caller can convert it to a Buffer if needed
   */
  public async getSignatureFromActivity(activityId: string): Promise<string> {
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
        activityStatus: activity.status as TActivityStatus,
      });
    }

    if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
      throw new TurnkeyActivityError({
        message: `Activity is not yet completed: ${activity.status}`,
        activityId: activity.id,
        activityStatus: activity.status as TActivityStatus,
      });
    }

    const { r, s } = activity.result?.signRawPayloadResult!;

    return assertNonNull(`${r}${s}`);
  }

  /**
   * This function is a helper method to easily extract signature strings from a completed signing activity.
   * Particularly useful for scenarios where a signature requires consensus.
   * This can be used in conjunction with the `signAllTransactions()` method included in this SDK.
   * The resulting signatures can be added to transactions via `tx.addSignature(fromKey, Buffer.from(signature), "hex"))`
   *
   * @param activityId the signing activity
   * @return signature strings. Caller can convert each to a Buffer if needed
   */
  public async getSignaturesFromActivity(
    activityId: string
  ): Promise<string[]> {
    const { activity } = await this.client.getActivity({
      organizationId: this.organizationId,
      activityId,
    });

    if (activity.type !== "ACTIVITY_TYPE_SIGN_RAW_PAYLOADS") {
      throw new TurnkeyActivityError({
        message: `Unexpected activity type: ${activity.type}`,
        activityId: activity.id,
        activityStatus: activity.status as TActivityStatus,
      });
    }

    if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
      throw new TurnkeyActivityError({
        message: `Activity is not yet completed: ${activity.status}`,
        activityId: activity.id,
        activityStatus: activity.status as TActivityStatus,
      });
    }

    const { signatures } = activity.result?.signRawPayloadsResult!;

    const signatureStrings = signatures?.map(
      (sig: TSignature) => `${sig?.r}${sig?.s}`
    );

    return assertNonNull(signatureStrings);
  }

  private async signRawPayload(payload: string, signWith: string) {
    if (this.client instanceof TurnkeyClient) {
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

      return assertNonNull(result?.signRawPayloadResult);
    } else {
      const { activity, r, s, v } = await this.client.signRawPayload({
        signWith,
        payload,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        // Note: unlike ECDSA, EdDSA's API does not support signing raw digests (see RFC 8032).
        // Turnkey's signer requires an explicit value to be passed here to minimize ambiguity.
        hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      });

      if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
        throw new TurnkeyActivityError({
          message: `Unexpected activity status: ${activity.status}`,
          activityId: activity.id,
          activityStatus:
            activity.status as TActivityStatus,
        });
      }

      return assertNonNull({
        r,
        s,
        v,
      });
    }
  }

  private async signRawPayloads(payloads: string[], signWith: string) {
    if (this.client instanceof TurnkeyClient) {
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

      return assertNonNull(result?.signRawPayloadsResult);
    } else {
      const { activity, signatures } = await this.client.signRawPayloads({
        signWith,
        payloads,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        // Note: unlike ECDSA, EdDSA's API does not support signing raw digests (see RFC 8032).
        // Turnkey's signer requires an explicit value to be passed here to minimize ambiguity.
        hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      });

      if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
        throw new TurnkeyActivityError({
          message: `Unexpected activity status: ${activity.status}`,
          activityId: activity.id,
          activityStatus:
            activity.status as TActivityStatus,
        });
      }

      return assertNonNull(
        signatures as TurnkeyApiTypes["v1SignRawPayloadsResult"]
      );
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

function assertNonNull<T>(input: T | null | undefined): T {
  if (input == null) {
    throw new Error(`Got unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
