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
import { mainnet } from "viem/chains";
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
    chain: mainnet,
    transport: http(
      `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY!}`,
    ),
  });

  const typedData = {
    account: turnkeyAccount as Account,
    domain: {
      name: "Permit2",
      chainId: 1n,
      verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    },
    types: {
      // Including EIP712Domain explicitly ensures direct serializers preserve
      // every domain field as well.
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
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
    primaryType: "PermitTransferFrom",
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
  } as const;

  // This signs and recovers the payload; it does not execute the transfer onchain.
  const signature = await client.signTypedData(typedData);
  const recoveredAddress = await recoverTypedDataAddress({
    ...typedData,
    signature,
  });

  assertEqual(client.account.address, recoveredAddress);
  print("Turnkey-powered Permit2 signature:", signature);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
