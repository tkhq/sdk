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
import abi from "./abi.json";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
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
    privateKeyId: process.env.PRIVATE_KEY_ID!,
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

//   const account = client?.account?.address;
  const hash = await client.writeContract({
    abi,
    address: "0x85111DF47D97Cc1aB3e76889fCF08594d053E85d",
    functionName: "mint",
    chain: goerli,
    account: client?.account,
  });

  print("Mint transaction hash:", hash);

  const publicClient = createPublicClient({
    transport: http("https://rpc.ankr.com/eth_goerli"),
    chain: goerli,
  });

  const { request } = await publicClient.simulateContract({
    abi,
    address: "0x85111DF47D97Cc1aB3e76889fCF08594d053E85d",
    functionName: "mint",
    chain: goerli,
    account: client?.account,
  });

  const hash2 = await client.writeContract(request);

  print("Mint transaction hash 2, post-simulation:", hash2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


// Alternatively for invoking, say, the Goerli WETH contract
//
//
// import wethAbi from "./weth-abi.json";

// const hash = await client.writeContract({
//   abi: wethAbi,
//   address: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
//   functionName: "deposit",
//   chain: goerli,
//   value: 1n,
// });

// const { request } = await publicClient.simulateContract({
//     abi: wethAbi,
//     address: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
//     functionName: "deposit",
//     chain: goerli,
//     value: 1n,
//     account
//   });

