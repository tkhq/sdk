import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { coins } from "@cosmjs/amino";
import { Secp256k1, Secp256k1Signature, sha256 } from "@cosmjs/crypto";
import { fromBase64, fromHex, toHex } from "@cosmjs/encoding";
import {
  makeAuthInfoBytes,
  makeSignBytes,
  makeSignDoc,
} from "@cosmjs/proto-signing";
import { createNewCosmosPrivateKey } from "./createNewCosmosPrivateKey";
import { print, refineNonNull } from "./shared";
import { TurnkeyDirectWallet } from "./TurnkeyDirectWallet";

async function main() {
  if (!process.env.PRIVATE_KEY_ID) {
    // If you don't specify a `PRIVATE_KEY_ID`, we'll create one for you via calling the Turnkey API.
    await createNewCosmosPrivateKey();
    return;
  }

  const wallet = await TurnkeyDirectWallet.init({
    config: {
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      baseUrl: process.env.BASE_URL!,
      organizationId: process.env.ORGANIZATION_ID!,
      privateKeyId: process.env.PRIVATE_KEY_ID!,
    },
    prefix: "cosmos",
  });

  const account = refineNonNull((await wallet.getAccounts())[0]);
  const compressedPublicKey = toHex(account.pubkey);

  print("Wallet address:", account.address);
  print("Compressed public key:", compressedPublicKey);

  // Test taken from https://github.com/cosmos/cosmjs/blob/e8e65aa0c145616ccb58625c32bffe08b46ff574/packages/proto-signing/src/directsecp256k1wallet.spec.ts#L35
  const accountNumber = 1;
  const sequence = 0;
  const bodyBytes =
    "0a90010a1c2f636f736d6f732e62616e6b2e763162657461312e4d736753656e6412700a2d636f736d6f7331706b707472653766646b6c366766727a6c65736a6a766878686c63337234676d6d6b38727336122d636f736d6f7331717970717870713971637273737a673270767871367273307a716733797963356c7a763778751a100a0575636f736d120731323334353637";

  const pubkey = {
    typeUrl: "/cosmos.crypto.secp256k1.PubKey",
    value: account.pubkey,
  };
  const fee = coins(2000, "ucosm");
  const gasLimit = 200000;
  const chainId = "simd-testing";
  const feePayer = undefined;
  const feeGranter = undefined;
  const signDoc = makeSignDoc(
    fromHex(bodyBytes),
    makeAuthInfoBytes(
      [{ pubkey, sequence }],
      fee,
      gasLimit,
      feeGranter,
      feePayer
    ),
    chainId,
    accountNumber
  );
  const signDocBytes = makeSignBytes(signDoc);
  const { signature } = await wallet.signDirect(account.address, signDoc);
  const isSignatureValid = await Secp256k1.verifySignature(
    Secp256k1Signature.fromFixedLength(fromBase64(signature.signature)),
    sha256(signDocBytes),
    pubkey.value
  );

  print("Signature:", JSON.stringify(signature, null, 2));
  print("Is signature valid?", String(isSignatureValid));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
