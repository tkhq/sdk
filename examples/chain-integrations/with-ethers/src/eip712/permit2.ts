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

  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient,
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const address = await turnkeySigner.getAddress();
  print("Address:", address);

  // Sign a Permit2 signature-transfer authorization. This example signs and
  // recovers the payload; it does not execute the transfer onchain.
  const permit2Payload = {
    types: {
      TokenPermissions: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      PermitTransferFrom: [
        { name: "permitted", type: "TokenPermissions" },
        { name: "spender", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    domain: {
      name: "Permit2",
      chainId: 1,
      verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    },
    message: {
      permitted: {
        // Mainnet USDC, with six decimal places.
        token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        amount: 1_000_000n,
      },
      spender: "0x2222222222222222222222222222222222222222",
      nonce: 0n,
      deadline: 1_992_689_033n,
    },
  };

  const signature = await turnkeySigner.signTypedData(
    permit2Payload.domain,
    permit2Payload.types,
    permit2Payload.message,
  );

  const recoveredAddress = ethers.verifyTypedData(
    permit2Payload.domain,
    permit2Payload.types,
    permit2Payload.message,
    signature,
  );

  assertEqual(recoveredAddress, address);
  print("Turnkey-powered Permit2 signature:", signature);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
