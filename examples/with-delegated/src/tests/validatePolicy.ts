// This is a simple script to validate the suborganization configured policy
import { Turnkey } from "@turnkey/sdk-server";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const turnkeyDelegated = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: process.env.NEXT_PUBLIC_DA_PRIVATE_KEY!,
    apiPublicKey: process.env.NEXT_PUBLIC_DA_PUBLIC_KEY!,
    defaultOrganizationId: "<demo_suborg_id>",
  }).apiClient();

  async function signTx(raw_tx: string, label: string) {
    console.log(`\n=== ${label} ===`);
    try {
      const { signedTransaction } = await turnkeyDelegated.signTransaction({
        signWith: "<suborg_ethereum_wallet_address>",
        type: "TRANSACTION_TYPE_ETHEREUM",
        unsignedTransaction: raw_tx,
      });
      console.log("✅ Successfully signed transaction:");
      console.log(signedTransaction);
    } catch (err) {
      console.error("❌ Failed to sign transaction:");
      console.log((err as Error).message);
    }
    console.log("=".repeat(40));
  }

  //generate a tx https://build.tx.xyz/ from your sub-org wallet address to the RECIPIENT_ADDRESS
  const allowedTransaction = "<unsigned_tx>";
  //generate a tx https://build.tx.xyz/ from your sub-org wallet address to a different Ethereum address
  const deniedTransaction = "<unsigned_tx>";
  // this activity should be allowed by the Turnkey Policy engine
  await signTx(allowedTransaction, "Policy Tx Allow");
  // this activity should be denied by the Turnkey Policy engine
  await signTx(deniedTransaction, "Policy Tx Deny");
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
