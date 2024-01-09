import { PublicKey, type Transaction } from "@solana/web3.js";
import { TurnkeyActivityError, TurnkeyClient } from "@turnkey/http";

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

    const response = await this.client.signRawPayload({
      type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
      organizationId: this.organizationId,
      timestampMs: String(Date.now()),
      parameters: {
        signWith: fromAddress,
        payload: messageToSign.toString("hex"),
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

    // TODO: handle other failure types here (500? 400? How is that surfaced?)

    const signature = `${result.signRawPayloadResult?.r}${result.signRawPayloadResult?.s}`;

    tx.addSignature(fromKey, Buffer.from(signature, "hex"));
  }
}
