import { test, expect, describe } from "@jest/globals";
import { TurnkeySigner } from "../";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

describe("TurnkeySigner", () => {
  const organizationId = "4456e4c2-e8b5-4b93-a0cf-1dfae265c12c";
  const apiPublicKey = "025d374c674fc389c761462f3c59c0acabdcb3a17c599d9e62e5fe78fe984cfbeb";
  const turnkeySolAddress = 'D8P541wwnertZTgDT14kYJPoFT2eHUFqjTgPxMK5qatM';
  test("can sign a Solana transfer against production", async () => {
    if (!process.env.SOLANA_TEST_ORG_API_PRIVATE_KEY) {
      // This test requires an env var to be set
      console.warn(
        "This test is skipped because it cannot run without SOLANA_TEST_ORG_API_PRIVATE_KEY set"
      );
      return;
    }

    const client = new TurnkeyClient(
      { baseUrl: "https://api.turnkey.com" },
      new ApiKeyStamper({
        apiPublicKey,
        apiPrivateKey: process.env.SOLANA_TEST_ORG_API_PRIVATE_KEY,
      })
    );

    const signer = new TurnkeySigner({
      organizationId,
      client,
    });

    const transferTransaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(turnkeySolAddress),
        // Destination doesn't matter, we set it to the Turnkey war chest!
        toPubkey: new PublicKey("tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C"),
        lamports: 10000,
      })
    );

    // Doesn't really matter since we're not going to broadcast this transaction!
    // But if we don't set this the call to "serializeMessage fails."
    transferTransaction.recentBlockhash =
      "GZSq3KvoFVhE22CQsaWSAxBoAvRiZSs7xVNa6yPecMUu";
    transferTransaction.feePayer = new PublicKey(turnkeySolAddress);

    expect(transferTransaction.signatures.length).toBe(0);
    await signer.addSignature(transferTransaction, turnkeySolAddress);
    expect(transferTransaction.signatures.length).toBe(1);
  });

  test("can sign a message with a Solana account", async () => {
    if (!process.env.SOLANA_TEST_ORG_API_PRIVATE_KEY) {
      // This test requires an env var to be set
      console.warn(
          "This test is skipped because it cannot run without SOLANA_TEST_ORG_API_PRIVATE_KEY set"
      );
      return;
    }

    const client = new TurnkeyClient(
        { baseUrl: "https://api.turnkey.com" },
        new ApiKeyStamper({
          apiPublicKey,
          apiPrivateKey: process.env.SOLANA_TEST_ORG_API_PRIVATE_KEY,
        })
    );

    const signer = new TurnkeySigner({
      organizationId,
      client,
    });

    const signature = await signer.signMessage('Hello world', turnkeySolAddress);
    expect(signature).toBeDefined();
  });
});
