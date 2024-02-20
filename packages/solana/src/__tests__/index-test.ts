import { test, expect, describe } from "@jest/globals";
import { TurnkeySigner } from "../";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import {
  PublicKey,
  SIGNATURE_LENGTH_IN_BYTES,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

describe("TurnkeySigner", () => {
  const organizationId = "4456e4c2-e8b5-4b93-a0cf-1dfae265c12c";
  const apiPublicKey =
    "025d374c674fc389c761462f3c59c0acabdcb3a17c599d9e62e5fe78fe984cfbeb";
  const turnkeySolAddress = "D8P541wwnertZTgDT14kYJPoFT2eHUFqjTgPxMK5qatM";
  const defaultSignature = new Uint8Array(SIGNATURE_LENGTH_IN_BYTES);
  test("can sign a Solana transfer against production", async () => {
    if (!process.env.SOLANA_TEST_ORG_API_PRIVATE_KEY) {
      // This test requires an env var to be set
      throw new Error(
        "This test requires SOLANA_TEST_ORG_API_PRIVATE_KEY to be set"
      );
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

    const isValidSignature = nacl.sign.detached.verify(
      transferTransaction.serializeMessage(),
      transferTransaction.signature as Uint8Array,
      bs58.decode(turnkeySolAddress)
    );
    expect(isValidSignature).toBeTruthy();
  });

  test("can sign a versioned Solana transfer against production", async () => {
    if (!process.env.SOLANA_TEST_ORG_API_PRIVATE_KEY) {
      // This test requires an env var to be set
      throw new Error(
        "This test requires SOLANA_TEST_ORG_API_PRIVATE_KEY to be set"
      );
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

    const fromKey = new PublicKey(turnkeySolAddress);

    const instructions = [
      SystemProgram.transfer({
        fromPubkey: fromKey,
        // Destination doesn't matter, we set it to the Turnkey war chest!
        toPubkey: new PublicKey("tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C"),
        lamports: 10,
      }),
    ];

    // create v0 compatible message
    const messageV0 = new TransactionMessage({
      payerKey: fromKey,
      // Doesn't really matter since we're not going to broadcast this transaction!
      recentBlockhash: "GZSq3KvoFVhE22CQsaWSAxBoAvRiZSs7xVNa6yPecMUu",
      instructions,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // version transactions are initalized with a default signature
    expect(transaction.signatures.length).toBe(1);
    expect(transaction.signatures[0]).toEqual(defaultSignature);

    await signer.addSignature(transaction, turnkeySolAddress);

    // after signing the version transaction, the default signature is replaced with the new one
    expect(transaction.signatures.length).toBe(1);
    expect(transaction.signatures[0]).not.toEqual(defaultSignature);

    const isValidSignature = nacl.sign.detached.verify(
      transaction.message.serialize(),
      transaction.signatures[0] as Uint8Array,
      bs58.decode(turnkeySolAddress)
    );
    expect(isValidSignature).toBeTruthy();
  });

  test("can sign a message with a Solana account", async () => {
    if (!process.env.SOLANA_TEST_ORG_API_PRIVATE_KEY) {
      // This test requires an env var to be set
      throw new Error(
        "This test requires SOLANA_TEST_ORG_API_PRIVATE_KEY to be set"
      );
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

    const message = "Hello world!";
    const messageAsUint8Array = Buffer.from(message);

    const signature = await signer.signMessage(
      messageAsUint8Array,
      turnkeySolAddress
    );

    const isValidSignature = nacl.sign.detached.verify(
      messageAsUint8Array,
      signature,
      bs58.decode(turnkeySolAddress)
    );
    expect(isValidSignature).toBeTruthy();
  });
});
