import * as path from "path";
import * as dotenv from "dotenv";
import { TurnkeyClient, type TurnkeyApiTypes } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

export type ChainCaip2 = TurnkeyApiTypes["v1EarnDepositIntent"]["chainCaip2"];

export const CHAIN_CAIP2 = (process.env.CHAIN_CAIP2 ??
  "eip155:8453") as ChainCaip2;

// Underlying-asset filter for the vault catalog. Defaults to USDC on Base.
export const ASSET_CAIP19 =
  process.env.ASSET_CAIP19 ??
  "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required env var ${name} (see .env.local.example)`);
  }
  return value;
}

// newClient builds a stamping TurnkeyClient from `${prefix}_*` env vars.
// "PARENT" is the org that deploys the wrapper; "TURNKEY" is the demo org.
export function newClient(prefix: "PARENT" | "TURNKEY"): {
  client: TurnkeyClient;
  organizationId: string;
} {
  const orgVar =
    prefix === "PARENT" ? "PARENT_ORGANIZATION_ID" : "TURNKEY_ORGANIZATION_ID";

  return {
    client: new TurnkeyClient(
      { baseUrl: requireEnv("TURNKEY_BASE_URL") },
      new ApiKeyStamper({
        apiPublicKey: requireEnv(`${prefix}_API_PUBLIC_KEY`),
        apiPrivateKey: requireEnv(`${prefix}_API_PRIVATE_KEY`),
      }),
    ),
    organizationId: requireEnv(orgVar),
  };
}

type EarnRequestStatus = {
  status: "PENDING" | "COMPLETED" | "FAILED";
  txHash?: string | undefined;
  error?: string | undefined;
};

// pollEarnStatus polls fetch until the request resolves COMPLETED, throwing on
// FAILED or timeout. The activity completing only means "signed + enqueued";
// this is where an on-chain failure would surface.
export async function pollEarnStatus(
  label: string,
  fetch: () => Promise<EarnRequestStatus>,
  timeoutMs = 120_000,
): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const { status, txHash, error } = await fetch();

    if (status === "COMPLETED") {
      const link = txHash ? `https://basescan.org/tx/${txHash}` : "n/a";
      console.log(`✅ ${label} landed on-chain\n   ${link}`);
      return txHash;
    }
    if (status === "FAILED") {
      throw new Error(`${label} FAILED: ${error ?? "no error reported"} (tx: ${txHash ?? "n/a"})`);
    }
    if (Date.now() > deadline) {
      throw new Error(`${label} did not resolve in time (last status: ${status})`);
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

const CHAIN_NAMES: Record<string, string> = {
  "eip155:1": "Ethereum",
  "eip155:8453": "Base",
  "eip155:42161": "Arbitrum",
  "eip155:137": "Polygon",
  "eip155:56": "BNB Chain",
};

// chainName renders a CAIP-2 id (or the chain part of a CAIP-19 id) as a
// human-readable chain name, keeping the raw id alongside.
export function chainName(caip: string | undefined): string {
  if (!caip) return "unknown chain";

  const caip2 = caip.split("/")[0]!;

  return `${CHAIN_NAMES[caip2] ?? caip2} (${caip2})`;
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
// multicall — the fallback for responses that don't carry name/curator.
export async function vaultNamesOnChain(
  addresses: (string | undefined)[],
): Promise<string[]> {
  const { createPublicClient, erc20Abi, http } = await import("viem");
  const { base } = await import("viem/chains");

  const rpc = createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org"),
  });
  const results = await rpc.multicall({
    contracts: addresses.map((a) => ({
      address: a as `0x${string}`,
      abi: erc20Abi,
      functionName: "name" as const,
    })),
  });

  return results.map((r) => (r.status === "success" ? (r.result as string) : "?"));
}

// printOrgVaults renders the parent org's enabled vaults (the platform
// management view) and returns them.
export async function printOrgVaults(
  client: TurnkeyClient,
  organizationId: string,
) {
  const { enabledVaults = [] } = await client.earnEnabledVaults({ organizationId });

  const fallbackNames = enabledVaults.some((ev) => !ev.name)
    ? await vaultNamesOnChain(enabledVaults.map((ev) => ev.vaultAddress))
    : [];

  console.log(`🏛  Org enabled vaults (org ${organizationId}):`);
  if (enabledVaults.length === 0) {
    console.log("   (none)");
  }
  for (const [i, ev] of enabledVaults.entries()) {
    const label = ev.name ?? fallbackNames[i] ?? `${ev.provider} vault`;
    const curator = ev.curator ? ` (curated by ${ev.curator})` : "";
    console.log(`   ${C.bold}${label}${C.reset}${curator} — ${ev.vaultAddress}`);
    console.log(`     wrapper:          ${ev.wrapperAddress}`);
    console.log(`     net APY:          ${pct(ev.netApyPct)}`);
    console.log(
      `     fees:             client ${Number(ev.clientFeeBps) / 100}% · turnkey ${Number(ev.turnkeyFeeBps) / 100}% of yield`,
    );
    console.log(`     total deposited:  ${usd(ev.totalDeposited)} (all users)`);
  }

  return enabledVaults;
}

// resolveWrapper returns the enabled-vault entry to transact against:
// VAULT_ADDRESS from env when set, else the org's first enabled vault.
export async function resolveWrapper(client: TurnkeyClient, organizationId: string) {
  const { enabledVaults = [] } = await client.earnEnabledVaults({ organizationId });

  const vaultAddress = process.env.VAULT_ADDRESS || enabledVaults[0]?.vaultAddress;
  const vault = enabledVaults.find(
    (ev) => ev.vaultAddress?.toLowerCase() === vaultAddress?.toLowerCase(),
  );

  if (!vault?.wrapperAddress) {
    throw new Error(
      `vault ${vaultAddress ?? "(unset)"} is not enabled for this org — run \`pnpm deploy-vault\` from the parent org first`,
    );
  }

  return vault;
}

// printPositions fetches and prints the wallet's earn positions (in USD),
// returning them for assertions.
export async function printPositions(
  client: TurnkeyClient,
  organizationId: string,
  walletAddress: string,
  label: string,
) {
  const { positions = [] } = await client.earnPositions({
    organizationId,
    walletAddress,
  });

  // EarnPosition doesn't carry the vault name; read it on-chain.
  const names =
    positions.length > 0
      ? await vaultNamesOnChain(positions.map((p) => p.vaultAddress))
      : [];

  console.log(`📊 Positions ${label} (wallet ${walletAddress}):`);
  if (positions.length === 0) {
    console.log("   (none)");
  }
  for (const [i, p] of positions.entries()) {
    const net =
      BigInt(p.totalDeposited ?? 0) - BigInt(p.totalWithdrawn ?? 0);
    const yieldUnits = BigInt(p.currentValue ?? 0) - net;

    console.log(`   ${C.bold}${names[i] ?? `${p.provider} vault`}${C.reset} — ${p.vaultAddress}`);
    console.log(`     current value:    ${usd(p.currentValue)}`);
    console.log(`     total deposited:  ${usd(p.totalDeposited)}`);
    console.log(`     total withdrawn:  ${usd(p.totalWithdrawn)}`);
    console.log(`     yield (net):      ${usd(yieldUnits.toString())}`);
  }

  return positions;
}
