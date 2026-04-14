import * as path from "path";
import * as dotenv from "dotenv";
import prompts from "prompts";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { tempoModerato } from "viem/chains";
import { Actions, tempoActions, withFeePayer } from "viem/tempo";
import {
  Account,
  createClient,
  http,
  publicActions,
  walletActions,
  formatUnits,
} from "viem";
import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import { createNewWallet } from "./turnkey";
import { estimateTempoGas, print } from "./util";

// @ts-ignore
const PATH_USD = "0x20c0000000000000000000000000000000000000" as const;
// @ts-ignore
const ALPHA_USD = "0x20c0000000000000000000000000000000000001" as const;
// @ts-ignore
const BETA_USD = "0x20c0000000000000000000000000000000000002" as const;
// @ts-ignore
const THETA_USD = "0x20c0000000000000000000000000000000000003" as const;

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
      `${token.name} balance for ${address}:`,
      formatUnits(balance, token.decimals),
    );
    return;
  }

  print(
    `${token.name} balance for ${address} is 0! Funding... if unsuccessful, please add funds via the faucet:`,
    "https://docs.tempo.xyz/guide/use-accounts/add-funds",
  );
  const receipts = await Actions.faucet.fundSync(client, { account: address });
  const newBalance = await Actions.token.getBalance(client, {
    token: token.address,
    account: address,
  });

  print(
    `${token.name} Balance for ${address}:`,
    formatUnits(newBalance, token.decimals),
  );
  print(
    "Receipts:",
    receipts
      .map((r) => `https://explore.testnet.tempo.xyz/tx/${r.transactionHash}`)
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
    chain: tempoModerato.extend({ feeToken: ALPHA_USD }),
    transport: withFeePayer(
      http("https://rpc.moderato.tempo.xyz"),
      http("https://sponsor.moderato.tempo.xyz"),
    ),
  })
    .extend(publicActions)
    .extend(walletActions)
    .extend(tempoActions());

  const { name, decimals } = await Actions.token.getMetadata(client, {
    token: ALPHA_USD,
  });
  const token = { address: ALPHA_USD, name, decimals };

  print("Network:", `${client.chain.name} (chain ID ${client.chain.id})`);
  print("Address:", client.account.address);
  print("Token:", `${name} (${decimals} decimals)`);
  print(
    "Nonce:",
    `${await client.getTransactionCount({ address: client.account.address })}`,
  );

  const { numTransfers, destination, useSponsor } = await prompts([
    {
      type: "number",
      name: "numTransfers",
      message: "Number of transfers to batch",
      initial: 3,
    },
    {
      type: "text",
      name: "destination",
      message: "Destination address (default to TKHQ warchest)",
      initial: "0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7",
    },
    {
      type: "confirm",
      name: "useSponsor",
      message: process.env.SPONSOR_WITH
        ? `Sponsor fees with ${process.env.SPONSOR_WITH}?`
        : "Sponsor fees via sponsor.moderato.tempo.xyz?",
      initial: true,
    },
  ]);

  if (!numTransfers || numTransfers <= 0) {
    console.log("No transfers to send.");
    return;
  }

  // Collect amount for each transfer
  const amounts: string[] = [];
  for (let i = 0; i < numTransfers; i++) {
    const { amount } = await prompts({
      type: "text",
      name: "amount",
      message: `Amount for transfer ${i + 1}/${numTransfers} (atomic units, ${decimals} decimals)`,
      initial: "1000000",
    });
    amounts.push(amount);
  }

  console.log();

  await ensureFunded(client, client.account.address, token);

  const sponsorAccount =
    useSponsor && process.env.SPONSOR_WITH
      ? ((await createAccount({
        client: sdk.apiClient(),
        organizationId: process.env.ORGANIZATION_ID!,
        signWith: process.env.SPONSOR_WITH,
      })) as Account)
      : undefined;

  if (sponsorAccount) {
    await ensureFunded(client, sponsorAccount.address, token);
  }

  // Fee payer: custom sponsor account, public endpoint (true), or self (undefined)
  const feePayer = useSponsor ? (sponsorAccount ?? true) : undefined;

  // Build batch transfer calls
  const calls = amounts.map((amount) =>
    Actions.token.transfer.call({
      amount: BigInt(amount),
      token: ALPHA_USD,
      to: destination as `0x${string}`,
    }),
  );

  print("Sending batch of", `${calls.length} transfers...`);

  const estimatedGas = await estimateTempoGas(client, calls, 5n);


  // Send all transfers atomically in a single Tempo transaction with native batch calls
  const receipt = await client.sendTransactionSync({
    calls,
    feePayer,
    feeToken: ALPHA_USD,
    gas: estimatedGas,
  });

  print(
    "Receipt:",
    `https://explore.testnet.tempo.xyz/tx/${receipt.transactionHash}`,
  );

  const totalAmount = amounts.reduce((sum, a) => sum + BigInt(a), 0n);
  print(
    `Sent ${formatUnits(totalAmount, decimals)} ${name} to ${destination} in ${calls.length} batched transfers!`,
    "https://docs.tempo.xyz/protocol/transactions#batch-calls",
  );

  // Log post-transfer balances
  const senderBalance = await Actions.token.getBalance(client, {
    token: ALPHA_USD,
    account: client.account.address,
  });
  print(
    `${name} balance for sender (${client.account.address}):`,
    formatUnits(senderBalance, decimals),
  );

  if (destination.toLowerCase() !== client.account.address.toLowerCase()) {
    const destinationBalance = await Actions.token.getBalance(client, {
      token: ALPHA_USD,
      account: destination as `0x${string}`,
    });
    print(
      `${name} balance for destination (${destination}):`,
      formatUnits(destinationBalance, decimals),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
