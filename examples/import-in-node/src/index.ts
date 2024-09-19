import * as dotenv from "dotenv";
import * as path from "path";
import { input } from "@inquirer/prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { Crypto } from "@peculiar/webcrypto";
import {
  decodeKey,
  hpkeEncrypt,
  verifyEnclaveSignature,
} from "@turnkey/crypto";
import { uint8ArrayFromHexString } from "@turnkey/encoding";
global.crypto = new Crypto();

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const userId = process.env.USER_ID!;
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });
  const importType = await input({
    message: `Enter Import Type, either "wallet" or "key"`,
  });
  let initResult;
  if (importType == "wallet") {
    initResult = await turnkeyClient.apiClient().initImportWallet({
      userId,
    });
  } else if (importType == "key") {
    initResult = await turnkeyClient.apiClient().initImportPrivateKey({
      userId,
    });
  } else {
    throw new Error(`Invalid import type. Please enter "wallet" or "key"`);
  }
  const importBundle = JSON.parse(initResult.importBundle);

  const verified = await verifyEnclaveSignature(
    importBundle.enclaveQuorumPublic,
    importBundle.dataSignature,
    importBundle.data,
    "PREPROD"
  );
  if (!verified) {
    throw new Error(`failed to verify enclave signature: ${importBundle}`);
  }

  const signedData = JSON.parse(
    new TextDecoder().decode(uint8ArrayFromHexString(importBundle.data))
  );

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
  const targetKeyBuf = uint8ArrayFromHexString(signedData.targetPublic);
  if (importType == "wallet") {
    const mnemonic = await input({
      message: "Enter mnemonic seed phrase for wallet to import",
    });
    const plainTextBuf = new TextEncoder().encode(mnemonic);
    const walletBundle = hpkeEncrypt({ plainTextBuf, targetKeyBuf });
    const walletImportResult = await turnkeyClient.apiClient().importWallet({
      userId: userId,
      walletName: `example-import-wallet-node-${Date.now()}`,
      encryptedBundle: walletBundle,
      accounts: [],
    });
    console.log(
      `Successfully imported wallet with id: ${walletImportResult.walletId}`
    );
  }
  if (importType == "key") {
    const key = await input({
      message: "Enter Private Key to import",
    });
    const keyFormat = await input({
      message: "Enter Key Format, either HEXADECIMAL or SOLANA",
    });
    const plainTextBuf = decodeKey(key, keyFormat);
    const privateKeyBundle = hpkeEncrypt({ plainTextBuf, targetKeyBuf });

    const privateKeyImportResult = await turnkeyClient
      .apiClient()
      .importPrivateKey({
        userId: userId,
        privateKeyName: `example-import-private-key-node-${Date.now()}`,
        encryptedBundle: privateKeyBundle,
        curve: "CURVE_SECP256K1",
        addressFormats: ["ADDRESS_FORMAT_ETHEREUM"],
      });
    console.log(
      `Successfully imported wallet with id: ${privateKeyImportResult.privateKeyId}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
