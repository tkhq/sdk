import * as path from "path";
import * as dotenv from "dotenv";
import prompts from "prompts";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { tempoModerato } from "viem/chains";
import { Actions, tempoActions } from "viem/tempo";
import {
  createClient,
  http,
  publicActions,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  isAddress,
} from "viem";
import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";
import { createNewWallet } from "./turnkey";
import { print, sleep } from "./util";

// @ts-ignore
const ALPHA_USD = "0x20c0000000000000000000000000000000000001" as const;

// CAIP-2 identifier for Tempo Moderato. The generated SDK `caip2` union is
// currently stale and does not yet include Tempo, so we cast when passing it
// to `ethSendTransaction` (see the `as any` below).
const TEMPO_MODERATO_CAIP2 = "eip155:42431";

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
    `${token.name} balance for ${address}:`,
    formatUnits(newBalance, token.decimals),
  );
  print(
    "Receipts:",
    receipts
      .map((r) => `https://explore.testnet.tempo.xyz/tx/${r.transactionHash}`)
      .join("\n\t"),
  );
}

// Fetches the sponsored gas budget for the current window via Turnkey's
// `getGasUsage` query, returning the limit, the amount used and the remainder.
//
// Note: on testnet (e.g. Tempo Moderato), the configured limit won't change
// and usage will always report $0. Usage is denominated in the USD value of
// fees at broadcast time, and testnet fees are paid in a valueless test token,
// so there is nothing to meter. The numbers only move on mainnet.
async function fetchGasUsage(
  apiClient: ReturnType<TurnkeySDKServer["apiClient"]>,
) {
  const { usageUsd, windowLimitUsd, windowDurationMinutes } =
    await apiClient.getGasUsage({});

  const remainingUsd = Number(windowLimitUsd) - Number(usageUsd);

  return { usageUsd, windowLimitUsd, windowDurationMinutes, remainingUsd };
}

type GasUsage = Awaited<ReturnType<typeof fetchGasUsage>>;

function printGasRemaining(usage: GasUsage) {
  print(
    `Sponsored gas remaining (last ${usage.windowDurationMinutes} min window):`,
    `$${usage.remainingUsd} (of $${usage.windowLimitUsd} limit)`,
  );
}

function printGasUsage(usage: GasUsage) {
  print(
    `Sponsored gas usage (last ${usage.windowDurationMinutes} min window):`,
    [
      `used      $${usage.usageUsd}`,
      `limit     $${usage.windowLimitUsd}`,
      `remaining $${usage.remainingUsd}`,
    ].join("\n\t"),
  );
}

async function main() {
  if (!process.env.SIGN_WITH) {
    await createNewWallet();
    return;
  }

  // Turnkey's gas sponsorship requires a wallet/private-key *address* to sign
  // with; private key IDs are not supported by `ethSendTransaction`.
  const signWith = process.env.SIGN_WITH;
  if (!isAddress(signWith)) {
    throw new Error(
      "SIGN_WITH must be a wallet account address (0x...) for the sponsored flow; private key IDs are not supported by ethSendTransaction.",
    );
  }

  const apiClient = new TurnkeySDKServer({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  }).apiClient();

  // A read-only client for token metadata, balances and faucet funding. The
  // transaction itself is constructed, signed and broadcast by Turnkey — the
  // sender never holds native gas tokens.
  const client = createClient({
    chain: tempoModerato,
    transport: http("https://rpc.moderato.tempo.xyz"),
  })
    .extend(publicActions)
    .extend(tempoActions());

  const { name, decimals } = await Actions.token.getMetadata(client, {
    token: ALPHA_USD,
  });
  const token = { address: ALPHA_USD, name, decimals };

  print("Network:", `${client.chain.name} (chain ID ${client.chain.id})`);
  print("Address:", signWith);
  print("Token:", `${name} (${decimals} decimals)`);
  print("Gas sponsorship:", "Turnkey Gas Station (sponsor: true)");

  // Check the remaining sponsored gas budget before spending any of it.
  printGasRemaining(await fetchGasUsage(apiClient));

  const { amount, destination } = await prompts([
    {
      type: "text",
      name: "amount",
      message: `Amount to send (atomic units, ${decimals} decimals)`,
      initial: "1000000",
    },
    {
      type: "text",
      name: "destination",
      message: "Destination address (default to TKHQ warchest)",
      initial: "0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7",
    },
  ]);

  console.log();

  // The sender still needs the asset being transferred (AlphaUSD). Gas itself
  // is covered by Turnkey, so no native fee token is required.
  await ensureFunded(client, signWith, token);

  // Build a standard ERC20 transfer; on Tempo, TIP-20 tokens expose the ERC20
  // interface, so we encode `transfer(address,uint256)` calldata to the token.
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [destination as `0x${string}`, BigInt(amount)],
  });

  console.log("Submitting sponsored transaction via Turnkey...\n");

  // Turnkey constructs, signs, broadcasts and pays the fees. We pass a minimal
  // payload and omit gas/fee fields — they are unused for sponsored requests.
  const { sendTransactionStatusId } = await apiClient.ethSendTransaction({
    from: signWith,
    to: ALPHA_USD,
    value: "0",
    data,
    caip2: TEMPO_MODERATO_CAIP2 as any,
    sponsor: true,
  });

  print("Send transaction status ID:", sendTransactionStatusId);

  // Poll until Turnkey reports an on-chain transaction hash (or a failure).
  let txHash: string | undefined;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await apiClient.getSendTransactionStatus({
      sendTransactionStatusId,
    });

    if (status.eth?.txHash) {
      txHash = status.eth.txHash;
      break;
    }

    if (status.txStatus === "TX_STATUS_FAILED") {
      throw new Error(status.txError ?? "Sponsored transaction failed");
    }

    await sleep(1000);
  }

  if (!txHash) {
    throw new Error(
      `Timed out waiting for transaction to be included. Check status ID ${sendTransactionStatusId}.`,
    );
  }

  print("Receipt:", `https://explore.testnet.tempo.xyz/tx/${txHash}`);
  print(
    `Sent ${formatUnits(BigInt(amount), decimals)} ${name} to ${destination} (gas sponsored by Turnkey)!`,
    "https://docs.turnkey.com/features/transaction-management",
  );

  printGasUsage(await fetchGasUsage(apiClient));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
