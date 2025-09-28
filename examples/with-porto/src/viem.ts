import * as path from "path";
import * as dotenv from "dotenv";
import { createClient, http, parseEther, formatEther } from "viem";
import { baseSepolia } from "viem/chains";
import { RelayActions, Key } from "porto/viem";

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
  !process.env.ORGANIZATION_ID ||
  !process.env.RPC_URL
) {
  throw new Error(
    "Missing environment variables. Please check your .env.local file for SIGN_WITH, BASE_URL, API_PRIVATE_KEY, API_PUBLIC_KEY, ORGANIZATION_ID, and RPC_URL.",
  );
}

const turnkeyClient = new TurnkeyServerSDK({
  apiBaseUrl: process.env.BASE_URL,
  apiPrivateKey: process.env.API_PRIVATE_KEY,
  apiPublicKey: process.env.API_PUBLIC_KEY,
  defaultOrganizationId: process.env.ORGANIZATION_ID,
});

const debug = (...args: any[]) => {
  console.log("[*]", ...args);
};

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
    chain: TARGET_CHAIN, // or your target chain
    transport: http("https://rpc.porto.sh"),
  });

  // Create admin key for the upgraded account
  const adminKey = Key.createSecp256k1({ role: "admin" });

  debug(`Turnkey EOA address: ${turnkeyEoa.address}`);

  /** Upgrade the EOA wallet */

  // Step 1: Prepare the upgrade
  debug("Preparing to upgrade EOA to a Porto wallet...");
  const { digests, ...request } = await RelayActions.prepareUpgradeAccount(
    client,
    {
      address: turnkeyEoa.address,
      authorizeKeys: [adminKey],
      chain: TARGET_CHAIN,
    },
  );

  // Assert that turnkeyEoa has a sign function before proceeding
  if (!turnkeyEoa.sign || typeof turnkeyEoa.sign !== "function") {
    throw new Error("Turnkey EOA account must have a sign function");
  }

  // Step 2: Sign with your Turnkey EOA
  debug("Upgrade prepared. Signing transaction...");
  const signatures = {
    auth: await turnkeyEoa.sign({ hash: digests.auth }),
    exec: await turnkeyEoa.sign({ hash: digests.exec }),
  };

  // Step 3: Complete the upgrade
  debug("Executing upgrade transaction...");
  const portoAccount = await RelayActions.upgradeAccount(client, {
    ...request,
    signatures,
  });

  debug("Account successfully upgraded!");

  /** Make sure the account is funded */
  debug(`Make sure your account is funded with ${TARGET_CHAIN.name} ETH...`);

  let balance = (
    await RelayActions.getAssets(client, {
      account: turnkeyEoa.address,
      chainFilter: [TARGET_CHAIN.id],
      assetTypeFilter: ["native"],
    })
  )[TARGET_CHAIN.id][0].balance;
  debug(`${TARGET_CHAIN.name} ETH balance:`, balance);

  while (balance < AMOUNT_TO_SEND) {
    debug(`Waiting for funds...`);
    // Wait 1 second before checking again
    await new Promise((resolve) => setTimeout(resolve, 1000));
    balance = (
      await RelayActions.getAssets(client, {
        account: turnkeyEoa.address,
        chainFilter: [TARGET_CHAIN.id],
        assetTypeFilter: ["native"],
      })
    )[TARGET_CHAIN.id][0].balance;
  }
  debug(`Account funded with ${formatEther(balance)} ${TARGET_CHAIN.name} ETH`);

  /** Interact with the upgraded Porto wallet */

  const { id: userOpHash } = await RelayActions.sendCalls(client, {
    account: portoAccount,
    calls: [
      {
        to: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        value: parseEther("0.000001"),
      },
    ],
    chain: TARGET_CHAIN,
    key: adminKey,
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
