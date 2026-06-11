import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { createNewWallet } from "../createNewWallet";
import { print, assertEqual } from "../util";

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

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient,
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  // Bring your own provider (such as Alchemy or Infura: https://docs.ethers.org/v6/api/providers/)
  const network = "sepolia";
  const provider = new ethers.InfuraProvider(network);
  const connectedSigner = turnkeySigner.connect(provider);
  const address = await connectedSigner.getAddress();

  print("Address:", address);

  // Sign an EIP-712 Payload for an ERC-2612 Permit
  const approveAgentPayload = {
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    domain: {
      name: "USD Coin", // ERC-20 token name
      version: "1", // Token’s ERC-712 version
      chainId: 1, // Mainnet chain ID
      verifyingContract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    },
    primaryType: "Permit",
    message: {
      owner: "0x1111111111111111111111111111111111111111",
      spender: "0x2222222222222222222222222222222222222222",
      value: 10000, // amount to approve
      nonce: 0, // current permit nonce for owner
      deadline: 1992689033, // timestamp after which it’s invalid
    },
  };

  let signature = await connectedSigner.signTypedData(
    approveAgentPayload.domain,
    approveAgentPayload.types,
    approveAgentPayload.message,
  );

  let recoveredAddress = ethers.verifyTypedData(
    approveAgentPayload.domain,
    approveAgentPayload.types,
    approveAgentPayload.message,
    signature,
  );

  assertEqual(recoveredAddress, address);

  print(
    "Turnkey-powered signature - Hyperliquid Sign Transaction Payload:",
    `${signature}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
