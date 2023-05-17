import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import * as crypto from "crypto";
import { init as httpInit } from "@turnkey/http";
import { TurnkeyDirectWallet } from "./TurnkeyDirectWallet";
import { toHex } from "@cosmjs/encoding";
import { createCosmosPrivateKey } from "./createCosmosPrivateKey";
import { print, refineNonNull } from "./shared";

async function main() {
  httpInit({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
  });

  const privateKeyName = `Cosmos Key ${crypto.randomBytes(2).toString("hex")}`;

  const { privateKeyId } = await createCosmosPrivateKey({
    privateKeyName,
  });

  print("Private key ID:", privateKeyId);

  const wallet = await TurnkeyDirectWallet.fromTurnkeyPrivateKey({
    privateKeyId,
    prefix: "cosmos",
  });

  const account = refineNonNull((await wallet.getAccounts())[0]);

  print("Wallet address:", account.address);
  print("Compressed public key:", toHex(account.pubkey));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
