import { createAccount } from "@turnkey/viem";
import {
  createWalletClient,
  createPublicClient,
  erc20Abi,
  http,
  parseEther,
  type Account,
} from "viem";
import { base } from "viem/chains";
import { newClient, requireEnv, usdcToRaw } from "./common";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

// One-off transfer from SIGN_WITH (demo org wallet) on Base.
// Usage: pnpm transfer <to-address> <amount> [usdc]
// Amount is ETH by default; pass "usdc" as the third arg to send USDC.
async function main() {
  const [to, amount, token] = process.argv.slice(2);
  if (!to?.startsWith("0x") || !amount) {
    throw new Error("usage: pnpm transfer <to-address> <amount> [usdc]");
  }

  const { client, organizationId } = newClient("TURNKEY");
  const signWith = requireEnv("SIGN_WITH");

  const account = (await createAccount({
    client,
    organizationId,
    signWith,
  })) as Account;

  const transport = http("https://mainnet.base.org");
  const walletClient = createWalletClient({ account, chain: base, transport });
  const publicClient = createPublicClient({ chain: base, transport });

  let hash: `0x${string}`;
  if (token?.toLowerCase() === "usdc") {
    console.log(`Sending ${amount} USDC from ${signWith} to ${to}…`);
    hash = await walletClient.writeContract({
      account,
      chain: base,
      address: USDC,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to as `0x${string}`, BigInt(usdcToRaw(amount))],
    });
  } else {
    console.log(`Sending ${amount} ETH from ${signWith} to ${to}…`);
    hash = await walletClient.sendTransaction({
      account,
      chain: base,
      to: to as `0x${string}`,
      value: parseEther(amount),
    });
  }

  console.log(`tx: https://basescan.org/tx/${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ ${receipt.status} in block ${receipt.blockNumber}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
