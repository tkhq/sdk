import { describe, expect, it } from "@jest/globals";
import {
  Keypair,
  SystemProgram,
  Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";

import { TurnkeySigner } from "../";

const signer = Keypair.generate();
const recipient = Keypair.generate();

function makeTransaction(): Transaction {
  const tx = new Transaction();
  tx.add(
    SystemProgram.transfer({
      fromPubkey: signer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 1,
    }),
  );
  tx.recentBlockhash = Keypair.generate().publicKey.toBase58();
  tx.feePayer = signer.publicKey;

  return tx;
}

/** Returns `count` signatures regardless of how many payloads were sent. */
function clientReturning(count: number) {
  return {
    signRawPayloads: async () => ({
      activity: {
        id: "activity-id",
        status: "ACTIVITY_STATUS_COMPLETED",
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOADS",
      },
      signatures: Array.from({ length: count }, () => ({
        r: "11".repeat(32),
        s: "22".repeat(32),
        v: "00",
      })),
    }),
  };
}

describe("signAllTransactions", () => {
  it("signs every transaction when the response is complete", async () => {
    const turnkeySigner = new TurnkeySigner({
      organizationId: "organization-id",
      client: clientReturning(2) as any,
    });
    const txs: (Transaction | VersionedTransaction)[] = [
      makeTransaction(),
      makeTransaction(),
    ];

    const signed = await turnkeySigner.signAllTransactions(
      txs,
      signer.publicKey.toBase58(),
    );

    expect(signed).toHaveLength(2);
  });

  it("reports how many signatures were missing", async () => {
    const turnkeySigner = new TurnkeySigner({
      organizationId: "organization-id",
      client: clientReturning(1) as any,
    });
    const txs: (Transaction | VersionedTransaction)[] = [
      makeTransaction(),
      makeTransaction(),
    ];

    await expect(
      turnkeySigner.signAllTransactions(txs, signer.publicKey.toBase58()),
    ).rejects.toThrow("Expected 2 signature(s) from Turnkey, got 1");
  });
});
