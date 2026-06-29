import { Turnkey } from "@turnkey/sdk-server";
import { MeshTxBuilder, KoiosProvider } from "@meshsdk/core";
import {
  EnterpriseAddress,
  CredentialType,
  Hash28ByteBase16,
  VkeyWitness,
  TransactionWitnessSet,
  Ed25519PublicKeyHex,
  Ed25519SignatureHex,
  Serialization,
  resolveTxHash,
  addVKeyWitnessSetToTransaction,
} from "@meshsdk/core-cst";
import { blake2b } from "@noble/hashes/blake2b";
import { bytesToHex } from "@noble/hashes/utils";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// CARDANO_PUBLIC_KEY is your Turnkey Ed25519 account's public key (hex), created
// in the Turnkey app. For an ADDRESS_FORMAT_COMPRESSED account this is also the
// account address, so it doubles as `signWith`.
const {
  ORGANIZATION_ID,
  API_PUBLIC_KEY,
  API_PRIVATE_KEY,
  CARDANO_PUBLIC_KEY,
} = process.env;

const NETWORK = (process.env.NETWORK ?? "preprod") as
  | "preprod"
  | "preview"
  | "mainnet";
// Address network id: 1 = mainnet, 0 = any testnet (preprod/preview).
const NETWORK_ID = NETWORK === "mainnet" ? 1 : 0;

const turnkey = new Turnkey({
  apiBaseUrl: "https://api.turnkey.com",
  apiPrivateKey: API_PRIVATE_KEY!,
  apiPublicKey: API_PUBLIC_KEY!,
  defaultOrganizationId: ORGANIZATION_ID!,
});
const client = turnkey.apiClient();

// Koios is a free, public Cardano API (no signup) for protocol params, UTxOs,
// and submission. Pass the network shorthand ("api" = mainnet) — NOT a full
// URL, since the URL form attaches an invalid "Bearer undefined" auth header.
const provider = new KoiosProvider(NETWORK === "mainnet" ? "api" : NETWORK);

async function main() {
  // Derive the enterprise address client-side (Blake2b-224 of the public key).
  const pubKeyBytes = Buffer.from(CARDANO_PUBLIC_KEY!, "hex");
  const paymentKeyHash = bytesToHex(blake2b(pubKeyBytes, { dkLen: 28 }));
  const cardanoAddress = EnterpriseAddress.fromCredentials(NETWORK_ID, {
    hash: Hash28ByteBase16(paymentKeyHash),
    type: CredentialType.KeyHash,
  })
    .toAddress()
    .toBech32()
    .toString();
  console.log("Cardano address:", cardanoAddress);

  // Build an unsigned transaction (1 ADA back to ourselves).
  const utxos = await provider.fetchAddressUTxOs(cardanoAddress);
  if (!utxos.length) {
    throw new Error(`No UTxOs at ${cardanoAddress} — fund it from the faucet first.`);
  }
  const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider });
  const unsignedTx = await txBuilder
    .setNetwork(NETWORK)
    .txOut(cardanoAddress, [{ unit: "lovelace", quantity: "1000000" }])
    .changeAddress(cardanoAddress)
    .selectUtxosFrom(utxos)
    .complete();

  // Sign the tx body hash with Turnkey. Ed25519 does not pre-hash, so
  // hashFunction is HASH_FUNCTION_NOT_APPLICABLE.
  const txBodyHash = resolveTxHash(unsignedTx);
  const { r, s } = await client.signRawPayload({
    signWith: CARDANO_PUBLIC_KEY!,
    payload: txBodyHash,
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
  });

  // Assemble the vkey witness (signature is r + s, no v) and attach it.
  const vkeyWitness = new VkeyWitness(
    Ed25519PublicKeyHex(CARDANO_PUBLIC_KEY!),
    Ed25519SignatureHex(r + s),
  );
  const witnessSet = new TransactionWitnessSet();
  witnessSet.setVkeys(
    Serialization.CborSet.fromCore(
      [vkeyWitness.toCore()],
      VkeyWitness.fromCore,
    ),
  );
  const signedTx = addVKeyWitnessSetToTransaction(unsignedTx, witnessSet.toCbor());

  const submittedTxHash = await provider.submitTx(signedTx);
  console.log("Transaction submitted:", submittedTxHash);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
