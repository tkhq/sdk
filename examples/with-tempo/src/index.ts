import * as path from "path";
import * as dotenv from "dotenv";
import prompts from "prompts";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { tempo } from "tempo.ts/chains";
import { tempoActions, Actions, withFeePayer } from "tempo.ts/viem";
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

async function checkAndFundBalance(
  client: ReturnType<typeof createClient>,
  tokenAddress: `0x${string}`,
  accountAddress: `0x${string}`,
  metadata: { name: string; decimals: number },
) {
  const balance = await Actions.token.getBalance(client, {
    token: tokenAddress,
    account: accountAddress,
  });

  const printBalance = (balance: bigint) => {
    print(
      `${accountAddress} ${metadata.name} Balance:`,
      `${formatUnits(balance, metadata.decimals)}`,
    );
  }

  if (balance === 0n) {
    print(
      `${accountAddress} ${metadata.name} balance is 0! Funding account...`,
      "Learn more at https://docs.tempo.xyz/guide/quickstart/faucet",
    );

    const receipts = await Actions.faucet.fundSync(client, {
      account: accountAddress,
    });

    printBalance(await Actions.token.getBalance(client, {
      token: tokenAddress,
      account: accountAddress,
    }));
    print(
      "Receipts:",
      `${receipts
        .map(
          (receipt) =>
            `https://explore.tempo.xyz/tx/${receipt.transactionHash}`,
        )
        .join("\t\n")}`,
    );
  } else {
    printBalance(balance);
  }
}

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
    transport: withFeePayer(
      http(undefined, {
        fetchOptions: {
          headers: {
            Authorization: `Basic ${btoa(`${process.env["TEMPO_USERNAME"]}:${process.env["TEMPO_PASSWORD"]}`)}`,
          },
        },
      }),
      http("https://sponsor.testnet.tempo.xyz"),
    ),
  })
    .extend(publicActions)
    .extend(walletActions)
    .extend(tempoActions());

  const chainId = client.chain.id;
  const address = client.account.address;
  const transactionCount = await client.getTransactionCount({ address });

  const metadata = await Actions.token.getMetadata(client, {
    token: tip20TokenAddress,
  });

  print("Network:", `${client.chain.name} (chain ID ${chainId})`);
  print("Address:", address);
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

  const { useSponsor } = await prompts([
    {
      type: "confirm",
      name: "useSponsor",
      message: process.env.SPONSOR_WITH
        ? `Use sponsor wallet (${process.env.SPONSOR_WITH}) to pay fees?`
        : "Use public sponsor endpoint (sponsor.testnet.tempo.xyz) to pay fees?",
      initial: true,
    },
  ]);

  // Check balances and fund if needed
  await checkAndFundBalance(client, tip20TokenAddress, address, metadata);

  if (useSponsor && process.env.SPONSOR_WITH) {
    await checkAndFundBalance(
      client,
      tip20TokenAddress,
      process.env.SPONSOR_WITH as `0x${string}`,
      metadata,
    );
  }

  // Get the transfer call data using tempo.ts token actions
  const { receipt } = await client.token.transferSync({
    amount: parseUnits(amount, 6),
    token: tip20TokenAddress,
    to: destination as `0x${string}`,
    feePayer: useSponsor
      // sponsor with a Turnkey account or Tempo testnet public sponsor
      ? process.env.SPONSOR_WITH
        ? await createAccount({
            client: sdk.apiClient(),
            organizationId: process.env.ORGANIZATION_ID!,
            signWith: process.env.SPONSOR_WITH,
          })
        : true
      : undefined,
  });

  print(
    `Sent ${amount} ${metadata.name} to ${destination}:`,
    `https://explore.tempo.xyz/tx/${receipt.transactionHash}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
