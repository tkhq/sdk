import * as dotenv from "dotenv";
import * as path from "path";
import { Ed25519Keypair } from "@mysten/sui.js";

import { uint8ArrayFromHexString } from "@turnkey/encoding";
import { Turnkey } from "@turnkey/sdk-server";
import { createNewSuiWallet } from "./createSuiWallet";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;

  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });

  let suiCompressedPublicKey = process.env.SUI_COMPRESSED_PUBLIC_KEY!;
  if (!suiCompressedPublicKey) {
    suiCompressedPublicKey = await createNewSuiWallet(
      turnkeyClient.apiClient()
    );
    console.log(`\nYour new Sui pubkey: "${suiCompressedPublicKey}"`);
  } else {
    console.log(
      `\nUsing existing Sui pubkey from ENV: "${suiCompressedPublicKey}"`
    );
  }

  // Generate Sui address from raw Ed25519 public key
  const publicKeyBuffer = uint8ArrayFromHexString(suiCompressedPublicKey);
  const key = new Ed25519Keypair(publicKeyBuffer);
  const suiAddress = key.toSuiAddress();

  console.log("Sui address:", suiAddress);

  // Sign a transaction
  const signedPayload = await turnkeyClient.apiClient().signRawPayload({
    signWith: suiCompressedPublicKey,
    payload:
      "<your hex-encoded payload. this would be a serialized Sui transaction.>",
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    // Note: unlike ECDSA, EdDSA's API does not support signing raw digests (see RFC 8032).
    // Turnkey's signer requires an explicit value to be passed here to minimize ambiguity.
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
  });

  console.log("signedPayload:", signedPayload);

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
