import * as dotenv from "dotenv";
import * as path from "path";
import { input } from "@inquirer/prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { Crypto } from "@peculiar/webcrypto";
import {
  generateP256KeyPair,
  decryptExportBundle,
} from "@turnkey/crypto";
global.crypto = new Crypto();

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const keyPair = generateP256KeyPair()
  const privateKey = keyPair.privateKey
  const publicKey = keyPair.publicKeyUncompressed
  const organizationId = process.env.ORGANIZATION_ID!;
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });
  const exportType = await input({
    message: `Enter Export Type, either "wallet" or "key" or "account"`,
  });
  
  let exportResult;
  if (exportType == "wallet") {
    const walletId = await input({
      message: `Enter wallet id to export`,
    });
    exportResult = await turnkeyClient.apiClient().exportWallet({
      walletId,
      targetPublicKey: publicKey
    });
  } else if (exportType == "key") {
    const privateKeyId = await input({
      message: `Enter private key id to export`,
    });
    exportResult = await turnkeyClient.apiClient().exportPrivateKey({
      privateKeyId,
      targetPublicKey: publicKey
    });
  } 
  else if (exportType == "account") {
    const address = await input({
      message: `Enter address to export`,
    });
    exportResult = await turnkeyClient.apiClient().exportWalletAccount({
      address,
      targetPublicKey: publicKey
    });
  } 
  else {
    throw new Error(`Invalid export type. Enter "wallet" or "key" or "account"`);
  }
  const decryptedBundle = await decryptExportBundle({
    exportBundle: exportResult.exportBundle,
    embeddedKey: privateKey,
    organizationId,
    returnMnemonic: exportType == "wallet"
  })
  console.log(decryptedBundle)

}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
