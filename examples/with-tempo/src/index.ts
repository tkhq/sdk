import * as path from "path";
import * as dotenv from "dotenv";
import prompts from "prompts";

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

const TIP20_TOKEN = "0x20c0000000000000000000000000000000000001" as const;

async function ensureFunded(
  client: ReturnType<typeof createClient>,
  address: `0x${string}`,
  token: { address: `0x${string}`; name: string; decimals: number },
) {
  const balance = await Actions.token.getBalance(client, {
    token: token.address,
    account: address,
  });

  if (balance > 0n) {
    print(
      `${address} ${token.name} Balance:`,
      formatUnits(balance, token.decimals),
    );
    return;
  }

  print(
    `${address} ${token.name} balance is 0! Funding...`,
    "https://docs.tempo.xyz/guide/quickstart/faucet",
  );
  const receipts = await Actions.faucet.fundSync(client, { account: address });
  const newBalance = await Actions.token.getBalance(client, {
    token: token.address,
    account: address,
  });

  print(
    `${address} ${token.name} Balance:`,
    formatUnits(newBalance, token.decimals),
  );
  print(
    "Receipts:",
    receipts
      .map((r) => `https://explore.tempo.xyz/tx/${r.transactionHash}`)
      .join("\n\t"),
  );
}

async function main() {
  if (!process.env.SIGN_WITH) {
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
    signWith: process.env.SIGN_WITH,
  });

  const client = createClient({
    account: account as Account,
    chain: tempo({ feeToken: TIP20_TOKEN }),
    transport: withFeePayer(
      http(undefined, {
        fetchOptions: {
          headers: {
            Authorization: `Basic ${btoa(`${process.env.TEMPO_USERNAME}:${process.env.TEMPO_PASSWORD}`)}`,
          },
        },
      }),
      http("https://sponsor.testnet.tempo.xyz"),
    ),
  })
    .extend(publicActions)
    .extend(walletActions)
    .extend(tempoActions());

  const { name, decimals } = await Actions.token.getMetadata(client, {
    token: TIP20_TOKEN,
  });
  const token = { address: TIP20_TOKEN, name, decimals };

  print("Network:", `${client.chain.name} (chain ID ${client.chain.id})`);
  print("Address:", client.account.address);
  print(
    "Nonce:",
    `${await client.getTransactionCount({ address: client.account.address })}`,
  );

  const { amount, destination, useSponsor } = await prompts([
    { type: "text", name: "amount", message: "Amount to send", initial: "1" },
    {
      type: "text",
      name: "destination",
      message: "Destination address",
      initial: client.account.address,
    },
    {
      type: "confirm",
      name: "useSponsor",
      message: process.env.SPONSOR_WITH
        ? `Sponsor fees with ${process.env.SPONSOR_WITH}?`
        : "Sponsor fees via sponsor.testnet.tempo.xyz?",
      initial: true,
    },
  ]);

  await ensureFunded(client, client.account.address, token);

  const sponsorAccount =
    useSponsor && process.env.SPONSOR_WITH
      ? await createAccount({
          client: sdk.apiClient(),
          organizationId: process.env.ORGANIZATION_ID!,
          signWith: process.env.SPONSOR_WITH,
        })
      : undefined;

  if (sponsorAccount) {
    await ensureFunded(client, sponsorAccount.address, token);
  }

  // Fee payer: custom sponsor account, public endpoint (true), or self (undefined)
  const feePayer = useSponsor ? (sponsorAccount ?? true) : undefined;

  const { receipt } = await client.token.transferSync({
    amount: parseUnits(amount, decimals),
    token: TIP20_TOKEN,
    to: destination as `0x${string}`,
    feePayer,
  });

  print("Receipt:", `https://explore.tempo.xyz/tx/${receipt.transactionHash}`);
  print(
    `Sent ${amount} ${name} to ${destination}!`,
    "https://docs.tempo.xyz/guide/payments/sponsor-user-fees",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
