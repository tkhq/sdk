import * as path from "path";
import * as dotenv from "dotenv";

import { createApiKeyAccount } from "@turnkey/viem";
import { createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const turnkeyAccount = await createApiKeyAccount({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
    organizationId: process.env.ORGANIZATION_ID!,
    privateKeyId: process.env.PRIVATE_KEY_ID!,
  });

  const client = createWalletClient({
    account: turnkeyAccount,
    chain: sepolia,
    transport: http(
      `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY!}`
    ),
  });

  // This demo sends ETH back to our faucet (we keep a bunch of Sepolia ETH at this address)
  const turnkeyFaucet = "0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7";

  const transactionRequest = {
    to: turnkeyFaucet as `0x${string}`,
    value: 1000000000000000n,
  };

  const txHash = await client.sendTransaction(transactionRequest);

  print("Source address", client.account.address);
  print("Transaction", `https://sepolia.etherscan.io/tx/${txHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}
