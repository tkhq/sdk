import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import type { TurnkeyClient } from "@turnkey/http";
import { recentBlockhash } from "./solanaNetwork";
import { TurnkeySigner } from "@turnkey/solana";

/**
 * Creates a Solana transfer and signs it with Turnkey.
 * @param fromAddress
 * @param toAddress
 * @param amount amount to send in LAMPORTS (one SOL = 1000000000 LAMPS)
 * @param TurnkeyOrganizationId
 * @param TurnkeyPrivateKeyId
 */
export async function createAndSignTransfer(input: {
  client: TurnkeyClient;
  fromAddress: string;
  toAddress: string;
  amount: number;
  turnkeyOrganizationId: string;
  turnkeySolAddress: string;
}): Promise<Buffer> {
  const {
    client,
    fromAddress,
    toAddress,
    amount,
    turnkeyOrganizationId,
    turnkeySolAddress,
  } = input;
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
  transferTransaction.feePayer = fromKey;

  const signer = new TurnkeySigner({
    organizationId: turnkeyOrganizationId,
    client,
  });
  await signer.addSignature(transferTransaction, turnkeySolAddress);
  return transferTransaction.serialize();
}
