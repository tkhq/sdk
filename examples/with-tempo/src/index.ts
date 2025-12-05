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
  serializeTransaction,
} from "viem";
import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createNewWallet } from "./createNewWallet";
import { print } from "./util";

async function main() {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `SIGN_WITH`, we'll create a new wallet for you via calling the Turnkey API.
    await createNewWallet();
    return;
  }

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
    // The following config is useful in contexts where an activity requires consensus.
    // By default, if the activity is not initially successful, it will poll a maximum
    // of 3 times with an interval of 1000 milliseconds. Otherwise, use the values below.
    //
    // -----
    //
    // activityPoller: {
    //   intervalMs: 5_000,
    //   numRetries: 10,
    // },
  });

  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const credentials = `${process.env["TEMPO_USERNAME"]}:${process.env["TEMPO_PASSWORD"]}`;
  // AlphaUSD TIP-20 token address
  const tip20TokenAddress =
    "0x20c0000000000000000000000000000000000001" as `0x${string}`;
  const client = createClient({
    account: turnkeyAccount as Account,
    chain: tempo({ feeToken: tip20TokenAddress }),
    transport: http(undefined, {
      fetchOptions: {
        headers: {
          Authorization: `Basic ${btoa(credentials)}`,
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

  const metadata = await Actions.token.getMetadata(client, {
    token: tip20TokenAddress,
  });

  print("Network:", `${client.chain.name} (chain ID ${chainId})`);
  print("Address:", address);
  print(
    `${metadata.name} Balance:`,
    `${formatUnits(balance, metadata.decimals)}`,
  );
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

  if (balance === 0n) {
    print(
      `Your ${metadata.name} balance is 0! Funding your account...`,
      "See https://docs.tempo.xyz/guide/quickstart/faucet",
    );

    const receipts = await Actions.faucet.fundSync(client, {
      account: address,
    });

    balance = await Actions.token.getBalance(client, {
      token: tip20TokenAddress,
      account: address,
    });
    print(
      `${metadata.name} Balance:`,
      `${formatUnits(balance, metadata.decimals)}`,
    );
    print(
      "Receipts:",
      `${receipts
        .map(
          (receipt) =>
            `https://explore.tempo.xyz/tx/${receipt.transactionHash}`,
        )
        .join("\n")}`,
    );
  }

  // @ts-expect-error
  const { receipt } = await client.token.transferSync({
    token: tip20TokenAddress,
    to: destination as `0x${string}`,
    amount: parseUnits(amount, metadata.decimals),
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
