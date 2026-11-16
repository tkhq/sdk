import * as path from "path";
import * as dotenv from "dotenv";
import {
  Turnkey,
  type TurnkeyApiClient,
  type v1EarnEnabledVault,
  type v1EarnPosition,
} from "@turnkey/sdk-server";

// Load environment variables from `.env.local` before chain.ts reads them.
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  CHAIN_CAIP2,
  explorerLink,
  IS_SOLANA,
  RPC_URL,
  sameAddress,
} from "./chain";

export {
  ASSET_CAIP19,
  CATALOG_AVAILABLE,
  CHAIN_CAIP2,
  chainName,
  EARN_PROVIDER,
  IS_SOLANA,
  type ChainCaip2,
} from "./chain";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `missing required env var ${name} (see .env.local.example)`,
    );
  }
  return value;
}

// newClient builds a stamping sdk-server api client from `${prefix}_*` env
// vars. "PARENT" is the org that deploys the wrapper; "TURNKEY" is the demo org.
export function newClient(prefix: "PARENT" | "TURNKEY"): {
  client: TurnkeyApiClient;
  organizationId: string;
} {
  const organizationId = requireEnv(
    prefix === "PARENT" ? "PARENT_ORGANIZATION_ID" : "TURNKEY_ORGANIZATION_ID",
  );

  const client = new Turnkey({
    apiBaseUrl: requireEnv("TURNKEY_BASE_URL"),
    apiPublicKey: requireEnv(`${prefix}_API_PUBLIC_KEY`),
    apiPrivateKey: requireEnv(`${prefix}_API_PRIVATE_KEY`),
    defaultOrganizationId: organizationId,
  }).apiClient();

  return { client, organizationId };
}

type EarnRequestStatus = {
  status: "PENDING" | "COMPLETED" | "FAILED";
  txHash?: string | undefined;
  error?: string | undefined;
};

// pollEarnStatus polls fetch until the request resolves COMPLETED, throwing on
// FAILED or timeout. The activity completing only means "signed + enqueued";
// this is where an on-chain failure would surface. On Solana the tx hash is
// the base58 transaction signature.
export async function pollEarnStatus(
  label: string,
  fetch: () => Promise<EarnRequestStatus>,
  timeoutMs = 120_000,
): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const { status, txHash, error } = await fetch();

    if (status === "COMPLETED") {
      const link = txHash ? explorerLink(txHash) : "n/a";
      console.log(`✅ ${label} landed on-chain\n   ${link}`);
      return txHash;
    }
    if (status === "FAILED") {
      throw new Error(
        `${label} FAILED: ${error ?? "no error reported"} (tx: ${txHash ?? "n/a"})`,
      );
    }
    if (Date.now() > deadline) {
      throw new Error(
        `${label} did not resolve in time (last status: ${status})`,
      );
    }

    console.log(`… ${label} status: ${status}`);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

export const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  green: "\x1b[32m",
};

export const PARENT_TAG = `${C.cyan}${C.bold}[ PARENT ORG · platform ]${C.reset}`;
export const USER_TAG = `${C.magenta}${C.bold}[ SUB-ORG · end user ]${C.reset}`;

// header prints a step banner with the acting-org tag.
export function header(title: string, tag: string) {
  console.log(`\n${C.bold}━━━ ${title}${C.reset}  ${tag}\n`);
}

// ask prompts on an interactive terminal, returning fallback otherwise (or on
// empty input).
export async function ask(prompt: string, fallback: string): Promise<string> {
  if (process.stdin.isTTY !== true) return fallback;

  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = (
      await rl.question(`${prompt} ${C.dim}[${fallback}]${C.reset}: `)
    ).trim();

    return answer || fallback;
  } finally {
    rl.close();
  }
}

// usdcToRaw converts a "1.50"-style USDC amount to raw 6-decimal units.
export function usdcToRaw(amount: string): string {
  return String(Math.round(Number(amount) * 1_000_000));
}

// usd renders raw on-chain units as a dollar amount. Exact for USDC (6
// decimals, $1 peg); dev's display fields come back empty so we derive it.
export function usd(rawUnits: string | undefined, decimals = 6): string {
  if (rawUnits === undefined) return "$?";

  const value = Number(rawUnits) / 10 ** decimals;
  const maxFrac = value !== 0 && Math.abs(value) < 0.01 ? 6 : 2;

  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  })}`;
}

// pct renders an APY decimal fraction (e.g. "0.0432") as "4.32%".
export function pct(fraction: string | undefined): string {
  if (!fraction) return "?%";
  return `${(Number(fraction) * 100).toFixed(2)}%`;
}

// vaultNamesOnChain reads ERC-20 name() for a list of vault addresses in one
// multicall, the fallback for EVM responses that don't carry name/curator.
// Kamino vaults are not ERC-20s, so Solana (and chains without a configured
// RPC) get no names back and callers fall back to a provider label.
export async function vaultNamesOnChain(
  addresses: (string | undefined)[],
): Promise<string[]> {
  if (IS_SOLANA || !RPC_URL) return [];

  const { createPublicClient, erc20Abi, http } = await import("viem");

  const rpc = createPublicClient({ transport: http(RPC_URL) });
  const results = await rpc.multicall({
    contracts: addresses.map((a) => ({
      address: a as `0x${string}`,
      abi: erc20Abi,
      functionName: "name" as const,
    })),
  });

  return results.map((r) =>
    r.status === "success" ? (r.result as string) : "?",
  );
}

// providerLabel is the generic vault label when the API returns no name.
export function providerLabel(provider: string | undefined): string {
  switch (provider) {
    case "EARN_PROVIDER_MORPHO":
      return "Morpho vault";
    case "EARN_PROVIDER_AAVE":
      return "Aave reserve";
    case "EARN_PROVIDER_KAMINO":
      return "Kamino vault";
    default:
      return "vault";
  }
}

// printOrgVaults renders the parent org's enabled vaults on CHAIN_CAIP2 (the
// platform management view) and returns them.
export async function printOrgVaults(
  client: TurnkeyApiClient,
  organizationId: string,
) {
  const enabledVaults = await listEnabledVaults(client, organizationId);

  const fallbackNames = enabledVaults.some((ev) => !ev.name)
    ? await vaultNamesOnChain(enabledVaults.map((ev) => ev.vaultAddress))
    : [];

  console.log(`🏛  Org enabled vaults (org ${organizationId}):`);
  if (enabledVaults.length === 0) {
    console.log("   (none)");
  }
  for (const [i, ev] of enabledVaults.entries()) {
    const label = ev.name ?? fallbackNames[i] ?? providerLabel(ev.provider);
    const curator = ev.curator ? ` (curated by ${ev.curator})` : "";
    console.log(
      `   ${C.bold}${label}${C.reset}${curator} — ${ev.vaultAddress}`,
    );
    console.log(`     wrapper:          ${ev.wrapperAddress}`);
    console.log(`     deploy status:    ${ev.deployStatus ?? "?"}`);
    console.log(`     net APY:          ${pct(ev.netApyPct)}`);
    console.log(
      `     client fee:       ${Number(ev.clientFeeBps) / 100}% of yield`,
    );
    console.log(`     total deposited:  ${usd(ev.totalDeposited)} (all users)`);
    if (ev.claimableClientFee !== undefined) {
      console.log(`     claimable fee:    ${usd(ev.claimableClientFee)}`);
    }
  }

  return enabledVaults;
}

// listEnabledVaults returns the org's enabled vaults whose asset lives on
// CHAIN_CAIP2. The API returns every chain; the demo works on one at a time.
export async function listEnabledVaults(
  client: TurnkeyApiClient,
  organizationId: string,
): Promise<v1EarnEnabledVault[]> {
  const { enabledVaults = [] } = await client.listEarnEnabledVaults({
    organizationId,
  });

  return enabledVaults.filter(
    (ev: v1EarnEnabledVault) =>
      !ev.caip19 || ev.caip19.startsWith(`${CHAIN_CAIP2}/`),
  );
}

// resolveWrapper returns the enabled-vault entry to transact against:
// VAULT_ADDRESS from env when set, else the org's first enabled vault on
// CHAIN_CAIP2. On Solana, `vaultAddress` is the Kamino reserve and
// `wrapperAddress` is the kVault Turnkey created for the org.
export async function resolveWrapper(
  client: TurnkeyApiClient,
  organizationId: string,
) {
  const enabledVaults = await listEnabledVaults(client, organizationId);

  const vaultAddress =
    process.env.VAULT_ADDRESS || enabledVaults[0]?.vaultAddress;
  const vault = enabledVaults.find((ev) =>
    sameAddress(ev.vaultAddress, vaultAddress),
  );

  if (!vault?.wrapperAddress) {
    throw new Error(
      `vault ${vaultAddress ?? "(unset)"} is not enabled for this org on ${CHAIN_CAIP2} — run \`pnpm deploy-vault\` from the parent org first`,
    );
  }

  return vault;
}

// printPositions fetches and prints the wallet's earn positions (in USD),
// returning them for assertions.
export async function printPositions(
  client: TurnkeyApiClient,
  organizationId: string,
  walletAddress: string,
  label: string,
) {
  const { positions = [] } = await client.listEarnPositions({
    organizationId,
    walletAddress,
  });

  // EarnPosition doesn't carry the vault name; read it on-chain where we can.
  const names =
    positions.length > 0
      ? await vaultNamesOnChain(
          positions.map((p: v1EarnPosition) => p.vaultAddress),
        )
      : [];

  console.log(`📊 Positions ${label} (wallet ${walletAddress}):`);
  if (positions.length === 0) {
    console.log("   (none)");
  }
  for (const [i, p] of positions.entries()) {
    const net = BigInt(p.totalDeposited ?? 0) - BigInt(p.totalWithdrawn ?? 0);
    const yieldUnits = BigInt(p.currentValue ?? 0) - net;

    console.log(
      `   ${C.bold}${names[i] ?? providerLabel(p.provider)}${C.reset} — ${p.vaultAddress}`,
    );
    console.log(`     wrapper:          ${p.wrapperAddress}`);
    console.log(`     current value:    ${usd(p.currentValue)}`);
    console.log(`     total deposited:  ${usd(p.totalDeposited)}`);
    console.log(`     total withdrawn:  ${usd(p.totalWithdrawn)}`);
    console.log(`     yield (net):      ${usd(yieldUnits.toString())}`);
  }

  return positions;
}
