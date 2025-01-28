import * as path from "path";
import * as dotenv from "dotenv";

import { createAccount } from "@turnkey/viem";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import {
  createWalletClient,
  createPublicClient,
  http,
  type Account,
} from "viem";
import { goerli } from "viem/chains";
import { print } from "./util";
import { createNewWallet } from "./createNewWallet";
import WETH_TOKEN_ABI from "./weth-contract-abi.json";
const WETH_TOKEN_ADDRESS_GOERLI = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6";

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
    })
  );

  const turnkeyAccount = await createAccount({
    client: turnkeyClient,
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const client = createWalletClient({
    account: turnkeyAccount as Account,
    chain: goerli,
    transport: http(
      `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY!}`
    ),
  });

  const address = client.account.address;
  print("Address:", address);

  const publicClient = createPublicClient({
    transport: http("https://rpc.ankr.com/eth_goerli"),
    chain: goerli,
  });

  const { request } = await publicClient.simulateContract({
    abi: WETH_TOKEN_ABI,
    address: WETH_TOKEN_ADDRESS_GOERLI,
    functionName: "deposit",
    chain: goerli,
    value: 1n,
    account: client.account,
  });

  const hash = await client.writeContract(request);

  print(
    "Successfully wrapped ETH 🥳. Transaction:",
    `https://goerli.etherscan.io/tx/${hash}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
