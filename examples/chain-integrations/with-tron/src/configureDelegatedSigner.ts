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
  if (process.env.CONFIRM_TRON_PERMISSION_UPDATE !== "true") {
    throw new Error(
      "This replaces the account's active permissions and costs about 100 TRX. Re-run with CONFIRM_TRON_PERMISSION_UPDATE=true after reviewing the script.",
    );
  }

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
  if (ownerAddress === signerAddress) {
    throw new Error("The delegated signer must differ from the account owner");
  }

  const ownerAccount = await tronWeb.trx.getAccount(ownerAddress);
  if (ownerAccount.is_witness) {
    throw new Error("This example does not support witness accounts");
  }

  const ownerHex = TronWeb.address.toHex(ownerAddress).toLowerCase();
  const currentOwnerKey = ownerAccount.owner_permission?.keys.find(
    ({ address }) => TronWeb.address.toHex(address).toLowerCase() === ownerHex,
  );
  if (
    !currentOwnerKey ||
    currentOwnerKey.weight < ownerAccount.owner_permission.threshold
  ) {
    throw new Error(
      "TRON_ADDRESS cannot satisfy the account's current owner permission by itself",
    );
  }

  if (ownerAccount.balance < 100_000_000) {
    throw new Error(
      "The owner needs at least 100 TRX for the account permission update fee",
    );
  }

  const permissionUpdate =
    await tronWeb.transactionBuilder.updateAccountPermissions(
      ownerAddress,
      {
        type: 0,
        permission_name: "owner",
        threshold: 1,
        keys: [{ address: ownerAddress, weight: 1 }],
      },
      undefined,
      {
        type: 2,
        permission_name: "turnkey-delegated-transfer",
        threshold: 1,
        // Contract type 1 is TransferContract. The remaining 255 bits are unset.
        operations: `02${"00".repeat(31)}`,
        keys: [{ address: signerAddress, weight: 1 }],
      },
    );

  console.log("Replacing active permissions on:", ownerAddress);
  console.log("Delegated TransferContract signer:", signerAddress);

  const signedUpdate = await turnkeyClient.apiClient().signTransaction({
    signWith: ownerAddress,
    unsignedTransaction: permissionUpdate.raw_data_hex,
    type: "TRANSACTION_TYPE_TRON",
  });

  const result = await tronWeb.trx.sendHexTransaction(
    signedUpdate.signedTransaction,
  );

  if (!result.result) {
    throw new Error(`Tron broadcast failed: ${JSON.stringify(result)}`);
  }

  console.log("Permission update sent! ID:", result.txid);
  console.log(
    "Wait for confirmation before running the delegated signer example.",
  );
  console.log("https://nile.tronscan.org/#/transaction/" + result.txid);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
