import * as path from "path";
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { TurnkeySigner } from "@turnkey/ethers";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });


async function main () {

    // Initialize Turnkey client and signer
      const turnkeyClient = new TurnkeyClient(
        { baseUrl: process.env.TURNKEY_BASE_URL! },
        new ApiKeyStamper({
          apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
          apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
        })
      );
    
      // Replace with your wallet address or fetched wallet from Turnkey
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
    const exitPayload = {
  yieldId: process.env.YIELD_ID,
  address: turnkeyAccount.address,
  arguments: { amount: "0.1" },
};

const exitRes = await fetch("https://api.yield.xyz/v1/actions/exit", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.YIELD_API_KEY!,
  },
  body: JSON.stringify(exitPayload),
});
const exitAction = await exitRes.json();

for (const tx of exitAction.transactions) {
	const unsignedTx = JSON.parse(tx.unsignedTransaction);
  const sent = await connectedSigner.sendTransaction({
        to: unsignedTx.to,
        data: unsignedTx.data,
        value: unsignedTx.value ?? '0x0',
        chainId: unsignedTx.chainId
      });
  console.log("Withdraw tx:", sent.hash);
}

}

main().catch((err) => {
  console.error("Error running Yield withdraw example:", err);
  process.exit(1);
});
