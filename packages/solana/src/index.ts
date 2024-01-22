import { PublicKey, type Transaction } from "@solana/web3.js";
import { TurnkeyActivityError, TurnkeyClient } from "@turnkey/http";
import type {definitions} from "@turnkey/http/dist/__generated__/services/coordinator/public/v1/public_api.types";

export class TurnkeySigner {
  public readonly organizationId: string;
  public readonly client: TurnkeyClient;

  constructor(input: { organizationId: string; client: TurnkeyClient }) {
    this.organizationId = input.organizationId;
    this.client = input.client;
  }

  /**
   * This function takes a Solana transaction and adds a signature with Turnkey
   *
   * @param tx Transaction object (native @solana/web3.js type)
   * @param fromAddress Solana address (base58 encoded)
   */
  public async addSignature(tx: Transaction, fromAddress: string) {
    const fromKey = new PublicKey(fromAddress);
    const messageToSign = tx.serializeMessage();

    const signRawPayloadResult = await this.signRawPayload(
        messageToSign.toString("hex"),
        "PAYLOAD_ENCODING_HEXADECIMAL",
        fromAddress,
    );

    const signature = `${signRawPayloadResult.signRawPayloadResult?.r}${signRawPayloadResult.signRawPayloadResult?.s}`;

    tx.addSignature(fromKey, Buffer.from(signature, "hex"));
  }

  /**
   * This function takes a message and returns it after being signed with Turnkey
   *
   * @param message The message to sign (string)
   * @param fromAddress Solana address (base58 encoded)
   */
  public async signMessage(message: string, fromAddress: string): Promise<string> {
    const signRawPayloadResult = await this.signRawPayload(
        message,
        "PAYLOAD_ENCODING_TEXT_UTF8",
        fromAddress,
    );
    return `${signRawPayloadResult.signRawPayloadResult?.r}${signRawPayloadResult.signRawPayloadResult?.s}`;
  }

  private async signRawPayload(payload: string, encoding: definitions["v1PayloadEncoding"], signWith: string) {
    const response = await this.client.signRawPayload({
      type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
      organizationId: this.organizationId,
      timestampMs: String(Date.now()),
      parameters: {
        signWith,
        payload,
        encoding,
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
}
