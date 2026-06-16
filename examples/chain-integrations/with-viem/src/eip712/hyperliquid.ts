import * as path from "path";
import * as dotenv from "dotenv";

import { createAccount } from "@turnkey/viem";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import {
  createWalletClient,
  http,
  recoverTypedDataAddress,
  type Account,
} from "viem";
import { sepolia } from "viem/chains";
import { print, assertEqual } from "../util";
import { createNewWallet } from "../createNewWallet";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `SIGN_WITH`, we'll create a new wallet for you via calling the Turnkey API.
    await createNewWallet();
    return;
  }

  const turnkeyClient = new TurnkeyClient(
    {
      baseUrl: process.env.BASE_URL!,
    },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    }),
  );

  const turnkeyAccount = await createAccount({
    client: turnkeyClient,
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const client = createWalletClient({
    account: turnkeyAccount as Account,
    chain: sepolia,
    transport: http(
      `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY!}`,
    ),
  });

  const address = client.account.address;
  print("Address:", address);

  // 3. Sign typed data (EIP-712)
  const domain = {
    name: "HyperliquidSignTransaction",
    version: "1",
    chainId: 1,
    verifyingContract: "0x0000000000000000000000000000000000000000",
  } as const;

  // The named list of all type definitions
  const types = {
    "HyperliquidTransaction:ApproveAgent": [
      { name: "hyperliquidChain", type: "string" },
      { name: "agentAddress", type: "address" },
      { name: "agentName", type: "string" },
      { name: "nonce", type: "uint64" },
    ],
  } as const;

  const payload = {
    account: turnkeyAccount as Account,
    domain,
    types,
    primaryType: "HyperliquidTransaction:ApproveAgent",
    message: {
      hyperliquidChain: "Testnet",
      signatureChainId: "0x1",
      agentAddress: "0x279f28cbbf5bd83c568ff6b599420b473319c25f",
      agentName: "Mobile QR",
      nonce: 1751566432540n,
      type: "approveAgent",
    },
  } as const;

  let signature = await client.signTypedData(payload);
  let recoveredAddress = await recoverTypedDataAddress({
    ...payload,
    signature,
  });

  print("Turnkey-powered signature - typed data (EIP-712):", `${signature}`);
  assertEqual(address, recoveredAddress);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
