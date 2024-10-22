import * as dotenv from "dotenv";
import * as path from "path";
import prompts from "prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { Crypto } from "@peculiar/webcrypto";
import {
  encryptPrivateKeyToBundle,
  encryptWalletToBundle,
} from "@turnkey/crypto";
if (typeof crypto === "undefined") {
  global.crypto = new Crypto();
}

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
  const { importType } = await prompts([
    {
      type: "text",
      name: "importType",
      message: `Enter Import Type, either "wallet" or "key"`,
    },
  ]);
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

  if (importType == "wallet") {
    const { mnemonic } = await prompts([
      {
        type: "text",
        name: "mnemonic",
        message: "Enter mnemonic seed phrase for wallet to import",
      },
    ]);
    const walletBundle = await encryptWalletToBundle({
      mnemonic,
      importBundle: initResult.importBundle,
      userId,
      organizationId,
    });
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
    const { privateKey } = await prompts([
      {
        type: "text",
        name: "privateKey",
        message: "Enter Private Key to import",
      },
    ]);
    const { keyFormat } = await prompts([
      {
        type: "text",
        name: "keyFormat",
        message: "Enter Key Format, either HEXADECIMAL or SOLANA",
      },
    ]);
    const privateKeyBundle = await encryptPrivateKeyToBundle({
      privateKey,
      keyFormat,
      importBundle: initResult.importBundle,
      userId,
      organizationId,
    });
    const privateKeyImportResult = await turnkeyClient
      .apiClient()
      .importPrivateKey({
        userId: userId,
        privateKeyName: `example-import-private-key-node-${Date.now()}`,
        encryptedBundle: privateKeyBundle,
        curve: keyFormat == "SOLANA" ? "CURVE_ED25519" : "CURVE_SECP256K1",
        addressFormats:
          keyFormat == "SOLANA"
            ? ["ADDRESS_FORMAT_SOLANA"]
            : ["ADDRESS_FORMAT_ETHEREUM"],
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
