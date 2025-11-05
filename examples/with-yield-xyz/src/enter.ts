import * as path from "path";
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { TurnkeySigner } from "@turnkey/ethers";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
   // Initialize Turnkey client and signer
  const turnkeyClient = new TurnkeyClient(
  {  baseUrl: process.env.TURNKEY_BASE_URL! },
  new ApiKeyStamper({
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
  })
);
  
const turnkeyAccount = {
  address: process.env.TURNKEY_WALLET_ADDRESS!,
 };

const turnkeySigner = new TurnkeySigner({
  client: turnkeyClient,
  organizationId: process.env.TURNKEY_ORG_ID!,
  signWith: turnkeyAccount.address,
});

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL!);
const connectedSigner = turnkeySigner.connect(provider);

// Prepare entry via Yield.xyz
const depositAmount = "0.5";
const enterPayload = {
  yieldId: process.env.YIELD_ID!, // e.g."base-usdc-gtusdcf-0x236919f11ff9ea9550a4287696c2fc9e18e6e890-4626-vault"
  address: turnkeyAccount.address,
  arguments: { amount: depositAmount },
};

const enterRes = await fetch("https://api.yield.xyz/v1/actions/enter", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.YIELD_API_KEY!,
  },
  body: JSON.stringify(enterPayload),
});
const action = await enterRes.json();

// Sign and broadcast each transaction step
for (const tx of action.transactions) {
	const unsignedTx = JSON.parse(tx.unsignedTransaction);
  const sent = await connectedSigner.sendTransaction({
        to: unsignedTx.to,
        data: unsignedTx.data,
        value: unsignedTx.value ?? '0x0',
        chainId: unsignedTx.chainId
      });
  console.log("Broadcasted tx:", sent.hash);
  await sent.wait(); //waiting for the approve transaction to be mined
}
}

main().catch((err) => {
  console.error("Error running Yield deposit example:", err);
  process.exit(1);
});

