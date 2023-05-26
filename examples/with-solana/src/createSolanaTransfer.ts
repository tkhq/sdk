import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { TurnkeyApi } from "@turnkey/http";
import { recentBlockhash } from "./solanaNetwork";
import base58 from "bs58";

  /**
   * Creates a Solana transfer and signs it with Turnkey.
   * @param fromAddress 
   * @param toAddress 
   * @param amount amount to send in LAMPORTS (one SOL = 1000000000 LAMPS)
   * @param TurnkeyOrganizationId 
   * @param TurnkeyPrivateKeyId 
   */
  export async function createAndSignTransfer(fromAddress: string, toAddress: string, amount: number, turnkeyOrganizationId: string, turnkeyPrivateKeyId: string): Promise<Buffer> {
    const fromKey = new PublicKey(fromAddress);
    const toKey = new PublicKey(toAddress);


    const transferTransaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKey,
        toPubkey: toKey,
        lamports: amount,
      })
    );

    // Get a recent block hash
    transferTransaction.recentBlockhash = await recentBlockhash();
    // Set the signer
    transferTransaction.setSigners(fromKey);

    const messageToSign = transferTransaction.serializeMessage();
    
    const activity = await TurnkeyApi.postSignRawPayload({
      body: {
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD",
        organizationId: turnkeyOrganizationId,
        timestampMs: String(Date.now()),
        parameters: {
          privateKeyId: turnkeyPrivateKeyId,
          payload: messageToSign.toString("hex"),
          encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
          hashFunction: "HASH_FUNCTION_UNSPECIFIED",
        },
      },
    });

    const signature = `${activity.activity.result.signRawPayloadResult?.r}${activity.activity.result.signRawPayloadResult?.s}`;
    console.log(`New signature: ${signature}\n(base58: ${base58.encode(Buffer.from(signature, "hex"))})`);

    transferTransaction.addSignature(fromKey, Buffer.from(signature, "hex"));
    return transferTransaction.serialize()
  }
  
