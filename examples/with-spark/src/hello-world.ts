/**
 * Hello, Spark + Turnkey.
 *
 * The smallest possible end-to-end smoke test: construct a SparkWallet whose
 * signer is backed by Turnkey, then ask Spark Service Operators for the
 * wallet's address and balance. If both of those work, the integration is
 * wired up correctly and you're ready to try `pnpm transfer`, `pnpm claim`,
 * etc.
 *
 * Prerequisite: run `pnpm setup` first to create a Turnkey wallet and write
 * the resulting env vars (TURNKEY_SPARK_ADDRESS, TURNKEY_ECDSA_ADDRESS,
 * IDENTITY_PUBLIC_KEY_HEX, …) into .env.local.
 *
 * Usage:
 *   pnpm hello-world
 */

import { uint8ArrayToHexString } from "@turnkey/encoding";
import { initSparkWallet } from "./init";

async function main() {
  // initSparkWallet() does three things behind the scenes (see init.ts):
  //   1. Load API credentials + wallet identifiers from .env.local
  //   2. Construct a TurnkeySparkSigner — a SparkSigner implementation that
  //      delegates every key/signing operation to a Turnkey activity
  //   3. Hand the signer to SparkWallet.initialize()
  //
  // After this returns, every key operation the SDK performs (Schnorr sigs,
  // FROST refunds, ECIES decrypts, …) goes through Turnkey's enclave; raw
  // private-key material never enters this process.
  const { wallet, signer, network } = await initSparkWallet();

  // identityPublicKey: the wallet owner's pubkey, as Spark SOs see it. Lives
  // at a fixed BIP32 path inside Turnkey.
  const identityPubkey = await signer.getIdentityPublicKey();

  // sparkAddress: bech32m of (network byte || identity pubkey). Lives on
  // Spark — fetching it verifies the signer can authenticate to the SOs.
  const sparkAddress = await wallet.getSparkAddress();

  // balance: lives on Spark Operators' state machines.
  const { satsBalance } = await wallet.getBalance();

  console.log(`Network:           ${network}`);
  console.log(`Spark address:     ${sparkAddress}`);
  console.log(`Identity pubkey:   ${uint8ArrayToHexString(identityPubkey)}`);
  console.log(`Balance (sats):    ${satsBalance?.available ?? 0}`);
  console.log(``);
  console.log(
    `Signer is wired up. Try \`pnpm transfer\`, \`pnpm claim\`, ` +
      `\`pnpm lightning:receive\`, or read ARCHITECTURE.md.`,
  );

  await wallet.cleanup();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
