import * as dotenv from "dotenv";
import * as path from "path";
import { input } from "@inquirer/prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { Crypto } from "@peculiar/webcrypto";
import {generateP256KeyPair, hpkeEncrypt} from "@turnkey/crypto";
import {uint8ArrayFromHexString} from "@turnkey/encoding"
import { verifyEnclaveSignature } from "./utils";
global.crypto = new Crypto();

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {

  const key = generateP256KeyPair();
  const targetPubHex = key.publicKeyUncompressed;
  const organizationId = process.env.ORGANIZATION_ID!;
  const userId = process.env.USER_ID!
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });
  const initResult = await turnkeyClient.apiClient().initImportPrivateKey({
    userId: process.env.USER_ID!
  });

  const importBundle = JSON.parse(initResult.importBundle)
  const verified = await verifyEnclaveSignature(importBundle.enclaveQuorumPublic, importBundle.dataSignature, importBundle.data)
  if (!verified) {
    throw new Error(`failed to verify enclave signature: ${importBundle}`);
  }

  const signedData = JSON.parse(
    new TextDecoder().decode(
      uint8ArrayFromHexString(importBundle.data)
    )
  );

  console.log(signedData)


if (
    !signedData.organizationId ||
    signedData.organizationId !== organizationId
  ) {
    throw new Error(
      `organization id does not match expected value. Expected: ${organizationId}. Found: ${signedData.organizationId}.`
    );
  }
if (!signedData.userId || signedData.userId !== userId) {
    throw new Error(
      `user id does not match expected value. Expected: ${userId}. Found: ${signedData.userId}.`
    );
  }

  if (!signedData.targetPublic) {
    throw new Error('missing "targetPublic" in bundle signed data');
  }

  // Load target public key generated from enclave and set in local storage
  const targetKeyBuf = uint8ArrayFromHexString(
    signedData.targetPublic
  );

  const plainTextBuf = new TextEncoder().encode("TEST_PK");
  console.log(hpkeEncrypt({plainTextBuf, targetKeyBuf}))
  //   // Create and sign a transaction
  //   const privateKey = await input({
  //     message: "Private Key:",
  //   });

    // hpkeEncrypt({
    //   plainTextBuf: Buffer.from(importBundle),

    // })
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

