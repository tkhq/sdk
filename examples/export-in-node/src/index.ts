import * as dotenv from "dotenv";
import * as path from "path";
import prompts from "prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { Crypto } from "@peculiar/webcrypto";
import { generateP256KeyPair, decryptExportBundle } from "@turnkey/crypto";
if (typeof crypto === "undefined") {
  global.crypto = new Crypto();
}

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const keyPair = generateP256KeyPair();
  const privateKey = keyPair.privateKey;
  const publicKey = keyPair.publicKeyUncompressed;
  const organizationId = process.env.ORGANIZATION_ID!;
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });
  const { exportType } = await prompts([
    {
      type: "text",
      name: "exportType",
      message: `Enter Export Type, either "wallet" or "key" or "account"`,
    },
  ]);

  let exportResult;
  if (exportType == "wallet") {
    const { walletId } = await prompts([
      {
        type: "text",
        name: "walletId",
        message: `Enter wallet id to export`,
      },
    ]);
    exportResult = await turnkeyClient.apiClient().exportWallet({
      walletId,
      targetPublicKey: publicKey,
    });
  } else if (exportType == "key") {
    const { privateKeyId } = await prompts([
      {
        type: "text",
        name: "privateKeyId",
        message: `Enter private key id to export`,
      },
    ]);
    exportResult = await turnkeyClient.apiClient().exportPrivateKey({
      privateKeyId,
      targetPublicKey: publicKey,
    });
  } else if (exportType == "account") {
    const { address } = await prompts([
      {
        type: "text",
        name: "address",
        message: `Enter address to export`,
      },
    ]);
    exportResult = await turnkeyClient.apiClient().exportWalletAccount({
      address,
      targetPublicKey: publicKey,
    });
  } else {
    throw new Error(
      `Invalid export type. Enter "wallet" or "key" or "account"`
    );
  }
  const decryptedBundle = await decryptExportBundle({
    exportBundle: exportResult.exportBundle,
    embeddedKey: privateKey,
    organizationId,
    returnMnemonic: exportType == "wallet",
  });
  // WARNING: Be VERY careful how you handle this bundle, this can be use to import your private keys/mnemonics anywhere and can lead to a potential loss of funds
  console.log(decryptedBundle);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
