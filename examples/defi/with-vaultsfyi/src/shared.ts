import * as path from "path";
import * as dotenv from "dotenv";
import { createAccount } from "@turnkey/viem";
import { Turnkey } from "@turnkey/sdk-server";
import { VaultsSdk, SUPPORTED_NETWORKS } from "@vaultsfyi/sdk";
import {
  createWalletClient,
  createPublicClient,
  http,
  type Account,
  type Chain,
} from "viem";
import {
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
} from "viem/chains";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

export type Network = (typeof SUPPORTED_NETWORKS)[number];

// ── Network resolution ──

const CHAIN_BY_NETWORK: Record<string, Chain> = {
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function resolveNetwork(network: string): {
  network: Network;
  chain: Chain;
} {
  if (!SUPPORTED_NETWORKS.includes(network as Network)) {
    throw new Error(
      `Unsupported network "${network}". Supported: ${SUPPORTED_NETWORKS.join(", ")}`,
    );
  }
  const chain = CHAIN_BY_NETWORK[network];
  if (!chain) {
    throw new Error(
      `No viem chain configured for "${network}". Add it to CHAIN_BY_NETWORK in shared.ts`,
    );
  }
  return { network: network as Network, chain };
}

// ── vaults.fyi SDK client ──

export const vaultsFyi = new VaultsSdk({
  apiKey: requireEnv("VAULTS_FYI_API_KEY"),
});

// ── Turnkey viem client (non-root) ──

export async function createClients(chain: Chain) {
  const turnkey = new Turnkey({
    apiBaseUrl: requireEnv("TURNKEY_BASE_URL"),
    apiPrivateKey: requireEnv("NONROOT_API_PRIVATE_KEY"),
    apiPublicKey: requireEnv("NONROOT_API_PUBLIC_KEY"),
    defaultOrganizationId: requireEnv("TURNKEY_ORGANIZATION_ID"),
  });

  const turnkeyAccount = await createAccount({
    client: turnkey.apiClient() as any,
    organizationId: requireEnv("TURNKEY_ORGANIZATION_ID"),
    signWith: requireEnv("SIGN_WITH"),
  });

  const transport = http(requireEnv("RPC_URL"));

  const walletClient = createWalletClient({
    account: turnkeyAccount as Account,
    chain,
    transport,
  });

  const publicClient = createPublicClient({
    chain,
    transport,
  });

  return {
    walletClient,
    publicClient,
    userAddress: turnkeyAccount.address,
  };
}

// ── Fetch asset address from vault ──

export async function getAssetAddress(
  network: Network,
  vaultId: string,
): Promise<string> {
  const vault = await vaultsFyi.getVault({
    path: { network, vaultId },
  });
  return vault.asset.address;
}

// ── Execute vaults.fyi action steps ──

type ActionStep = {
  name: string;
  tx: { to: string; chainId: number; data?: string; value?: string };
};

export async function executeActions(
  walletClient: Awaited<ReturnType<typeof createClients>>["walletClient"],
  publicClient: Awaited<ReturnType<typeof createClients>>["publicClient"],
  actions: ActionStep[],
  currentActionIndex: number,
) {
  for (const step of actions.slice(currentActionIndex)) {
    console.log(`Sending: ${step.name}...`);

    const hash = await walletClient.sendTransaction({
      account: walletClient.account!,
      to: step.tx.to as `0x${string}`,
      data: step.tx.data as `0x${string}` | undefined,
      value: step.tx.value ? BigInt(step.tx.value) : undefined,
    });
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 2,
    });

    if (receipt.status === "reverted") {
      throw new Error(
        `"${step.name}" reverted on-chain: https://basescan.org/tx/${hash}`,
      );
    }
    console.log(`  ✓ confirmed: https://basescan.org/tx/${hash}`);
  }
}
