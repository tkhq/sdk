import * as path from "path";
import * as dotenv from "dotenv";
import prompts from "prompts";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { tempo } from "tempo.ts/chains";
import { tempoActions, Actions } from "tempo.ts/viem";
import {
  Account,
  createClient,
  http,
  publicActions,
  walletActions,
  parseUnits,
  formatUnits,
} from "viem";
import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";
import { createAccount, createNewWallet } from "./turnkey";
import { print } from "./util";

async function main() {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `SIGN_WITH`, we'll create a new wallet for you via calling the Turnkey API.
    await createNewWallet();
    return;
  }

  const sdk = new TurnkeySDKServer({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const account = await createAccount({
    client: sdk.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  // AlphaUSD TIP-20 token address
  const tip20TokenAddress = "0x20c0000000000000000000000000000000000001";
  const client = createClient({
    account: account as Account,
    chain: tempo({ feeToken: tip20TokenAddress }),
    transport: http(undefined, {
      fetchOptions: {
        headers: {
          Authorization: `Basic ${btoa(`${process.env["TEMPO_USERNAME"]}:${process.env["TEMPO_PASSWORD"]}`)}`,
        },
      },
    }),
  })
    .extend(publicActions)
    .extend(walletActions)
    .extend(tempoActions());

  const chainId = client.chain.id;
  const address = client.account.address;
  const transactionCount = await client.getTransactionCount({ address });

  // Check TIP-20 token balance using tempo.ts token actions
  let balance = await Actions.token.getBalance(client, {
    token: tip20TokenAddress,
    account: address,
  });

  print("Network:", `${client.chain.name} (chain ID ${chainId})`);
  print("Address:", address);
  print("TIP-20 Balance:", `${formatUnits(balance, 6)} tokens`);
  print("Transaction count:", `${transactionCount}`);

  // create a simple send transaction
  const { amount, destination } = await prompts([
    {
      type: "text",
      name: "amount",
      message: "Amount to send  (default is 1 )",
      initial: "1",
    },
    {
      type: "text",
      name: "destination",
      message: "Destination address (default is yourself)",
      initial: address,
    },
  ]);
  while (balance === 0n) {
    console.log(
      [
        `\nYour TIP-20 token balance is at 0! To continue this demo you'll need testnet tokens!`,
        `\n--------`,
      ].join("\n"),
    );

    await prompts([
      {
        type: "text",
        name: "continue",
        message: "Ready to continue? y/n",
        initial: "y",
      },
    ]);

    balance = await Actions.token.getBalance(client, {
      token: tip20TokenAddress,
      account: address,
    });
  }

  // Get the transfer call data using tempo.ts token actions
  const { receipt } = await client.token.transferSync({
    amount: parseUnits(amount, 6),
    token: tip20TokenAddress,
    to: destination as `0x${string}`,
  });

  print(
    `Sent ${amount} TIP-20 tokens to ${destination}:`,
    `https://explore.tempo.xyz/tx/${receipt.transactionHash}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
