import * as path from "path";
import * as dotenv from "dotenv";
import { createClient, http, parseEther, formatEther } from "viem";
import { baseSepolia } from "viem/chains";
import { RelayActions, Key, Account } from "porto/viem";

import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const AMOUNT_TO_SEND = parseEther("0.000001");
const TARGET_CHAIN = baseSepolia;
const SCANNER_NETWORK = "base-sepolia";

if (
  !process.env.SIGN_WITH ||
  !process.env.BASE_URL ||
  !process.env.API_PRIVATE_KEY ||
  !process.env.API_PUBLIC_KEY ||
  !process.env.ORGANIZATION_ID
) {
  throw new Error(
    "Missing environment variables. Please check your .env.local file for SIGN_WITH, BASE_URL, API_PRIVATE_KEY, API_PUBLIC_KEY, ORGANIZATION_ID.",
  );
}

const debug = (...args: any[]) => {
  console.log("[*]", ...args);
};

const turnkeyClient = new TurnkeyServerSDK({
  apiBaseUrl: process.env.BASE_URL,
  apiPrivateKey: process.env.API_PRIVATE_KEY,
  apiPublicKey: process.env.API_PUBLIC_KEY,
  defaultOrganizationId: process.env.ORGANIZATION_ID,
});

async function main() {
  // Turnkey setup
  const signWith = process.env.SIGN_WITH!;
  const turnkeyEoa = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: signWith,
  });

  // Create Porto client
  const client = createClient({
    chain: TARGET_CHAIN,
    transport: http("https://rpc.porto.sh"),
  });

  debug("Setup complete, preparing to upgrade EOA to a Porto wallet...", {
    turnkeyEoa: turnkeyEoa.address,
  });

  const portoAccount = Account.from({
    address: turnkeyEoa.address,
    async sign({ hash }) {
      return await turnkeyEoa.sign!({ hash });
    },
  });

  await RelayActions.upgradeAccount(client, {
    account: portoAccount,
    chain: TARGET_CHAIN,
  });

  debug("Account successfully upgraded!");

  // Make sure the account is funded
  debug(`Make sure your account is funded with ${TARGET_CHAIN.name} ETH...`);

  let balance = (
    await RelayActions.getAssets(client, {
      account: portoAccount.address,
      chainFilter: [TARGET_CHAIN.id],
      assetTypeFilter: ["native"],
    })
  )[TARGET_CHAIN.id]![0]!.balance;

  while (balance < AMOUNT_TO_SEND) {
    debug(`Waiting for funds...`);
    // Wait 1 second before checking again
    await new Promise((resolve) => setTimeout(resolve, 1000));
    balance = (
      await RelayActions.getAssets(client, {
        account: portoAccount.address,
        chainFilter: [TARGET_CHAIN.id],
        assetTypeFilter: ["native"],
      })
    )[TARGET_CHAIN.id]![0]!.balance;
  }
  debug(`Account funded with ${formatEther(balance)} ${TARGET_CHAIN.name} ETH`);

  // Do something with the Porto account (in this case, send ETH)
  const { id: userOpHash } = await RelayActions.sendCalls(client, {
    account: portoAccount,
    calls: [
      {
        to: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        value: AMOUNT_TO_SEND,
      },
    ],
    chain: TARGET_CHAIN,
  });

  debug(`User operation sent: ${userOpHash}`);
  debug(
    `See details at https://jiffyscan.xyz/userOpHash/${userOpHash}?network=${SCANNER_NETWORK}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
