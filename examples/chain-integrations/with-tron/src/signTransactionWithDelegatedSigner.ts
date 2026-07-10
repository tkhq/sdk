import { Turnkey } from "@turnkey/sdk-server";
import { TronWeb } from "tronweb";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in .env.local`);
  }

  return value;
}

async function main() {
  const turnkeyClient = new Turnkey({
    apiBaseUrl: requiredEnv("BASE_URL"),
    apiPrivateKey: requiredEnv("API_PRIVATE_KEY"),
    apiPublicKey: requiredEnv("API_PUBLIC_KEY"),
    defaultOrganizationId: requiredEnv("ORGANIZATION_ID"),
  });

  const tronWeb = new TronWeb({
    fullHost: "https://nile.trongrid.io/", // Testnet
  });

  const ownerAddress = requiredEnv("TRON_ADDRESS");
  const signerAddress = requiredEnv("TRON_DELEGATED_SIGNER_ADDRESS");
  const permissionId = Number(requiredEnv("TRON_PERMISSION_ID"));
  if (!Number.isInteger(permissionId) || permissionId < 2) {
    throw new Error(
      "TRON_PERMISSION_ID must be an active permission ID (2 or greater)",
    );
  }

  if (ownerAddress === signerAddress) {
    throw new Error(
      "The delegated signer must differ from the transaction owner",
    );
  }

  const ownerAccount = await tronWeb.trx.getAccount(ownerAddress);
  const permission = ownerAccount.active_permission?.find(
    ({ id }) => id === permissionId,
  );
  if (!permission) {
    throw new Error(
      `Active permission ${permissionId} was not found for ${ownerAddress}`,
    );
  }

  const signerHex = TronWeb.address.toHex(signerAddress).toLowerCase();
  const signerKey = permission.keys.find(
    ({ address }) => TronWeb.address.toHex(address).toLowerCase() === signerHex,
  );
  if (!signerKey) {
    throw new Error(
      `${signerAddress} is not authorized by active permission ${permissionId}`,
    );
  }

  if (signerKey.weight < permission.threshold) {
    throw new Error(
      `The delegated signer weight (${signerKey.weight}) does not meet the permission threshold (${permission.threshold})`,
    );
  }

  const operations = permission.operations ?? "";
  const transferContractEnabled =
    operations.length >= 2 &&
    (Number.parseInt(operations.slice(0, 2), 16) & 2) !== 0;
  if (!transferContractEnabled) {
    throw new Error(
      `Active permission ${permissionId} does not allow TransferContract`,
    );
  }

  const recipientAddress = "TY1jfzP3s94oSzYECC89EFn17iA8S4imVZ";
  const amount = 100; // Amount in SUN (1 TRX = 1,000,000 SUN)
  const unsignedTx = await tronWeb.transactionBuilder.sendTrx(
    recipientAddress,
    amount,
    ownerAddress,
    { permissionId },
  );

  console.log("Transaction owner:", ownerAddress);
  console.log("Delegated signer:", signerAddress);
  console.log("Active permission ID:", permissionId);

  const signedTx = await turnkeyClient.apiClient().signTransaction({
    signWith: signerAddress,
    unsignedTransaction: unsignedTx.raw_data_hex,
    type: "TRANSACTION_TYPE_TRON",
  });

  const result = await tronWeb.trx.sendHexTransaction(
    signedTx.signedTransaction,
  );

  if (!result.result) {
    throw new Error(`Tron broadcast failed: ${JSON.stringify(result)}`);
  }

  console.log("Delegated transaction sent! ID:", result.txid);
  console.log("https://nile.tronscan.org/#/transaction/" + result.txid);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
