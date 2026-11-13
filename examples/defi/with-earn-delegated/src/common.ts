import * as path from "path";
import * as dotenv from "dotenv";
import {
  Turnkey,
  type TurnkeyApiClient,
  type v1EarnEnabledVault,
  type v1EarnPosition,
} from "@turnkey/sdk-server";

import { CHAINS } from "./config";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `missing required env var ${name} (see .env.local.example)`,
    );
  }
  return value;
}

type Role = "PARENT" | "CUSTOMER" | "DELEGATED";

const KEY_PREFIX: Record<Role, string> = {
  PARENT: "API",
  CUSTOMER: "CUSTOMER_API",
  DELEGATED: "DELEGATED_API",
};

// newClient builds a stamping sdk-server api client for one of the three
// actors. PARENT acts on the parent org (ORGANIZATION_ID); CUSTOMER and
// DELEGATED act inside the customer's sub-org, so they need its ID.
export function newClient(
  role: Role,
  subOrgId?: string,
): { client: TurnkeyApiClient; organizationId: string } {
  const organizationId =
    role === "PARENT" ? requireEnv("ORGANIZATION_ID") : subOrgId;
  if (!organizationId) {
    throw new Error(`${role} client needs the customer sub-org ID`);
  }

  const prefix = KEY_PREFIX[role];
  const client = new Turnkey({
    apiBaseUrl: process.env.BASE_URL?.trim() || "https://api.turnkey.com",
    apiPublicKey: requireEnv(`${prefix}_PUBLIC_KEY`),
    apiPrivateKey: requireEnv(`${prefix}_PRIVATE_KEY`),
    defaultOrganizationId: organizationId,
  }).apiClient();

  return { client, organizationId };
}

type RequestStatus = {
  status: string;
  txHash?: string | undefined;
  error?: string | undefined;
};

// pollEarnStatus polls fetch until the request resolves COMPLETED, throwing on
// FAILED or timeout. The activity completing only means "signed + enqueued";
// this is where an on-chain failure would surface.
export async function pollEarnStatus(
  label: string,
  caip2: string,
  fetch: () => Promise<RequestStatus>,
  timeoutMs = 180_000,
): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const { status, txHash, error } = await fetch();

    if (status === "COMPLETED") {
      console.log(`✅ ${label} landed on-chain\n   ${txLink(caip2, txHash)}`);
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
    await sleep(2_000);
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
};

export const PARENT_TAG = `${C.cyan}${C.bold}[ PARENT ORG · platform ]${C.reset}`;
export const USER_TAG = `${C.magenta}${C.bold}[ SUB-ORG · customer (root) ]${C.reset}`;
export const DELEGATED_TAG = `${C.yellow}${C.bold}[ SUB-ORG · platform delegated user ]${C.reset}`;

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

const chainInfo = (caip: string) =>
  CHAINS.find((c) => c.caip2 === caip2Of(caip));

// caip2Of returns the chain part of a CAIP-19 id (or a CAIP-2 id unchanged).
export function caip2Of(caip: string): string {
  return caip.split("/")[0]!;
}

export function isSolana(caip: string): boolean {
  return caip2Of(caip).startsWith("solana:");
}

// chainName renders a CAIP-2 id (or the chain part of a CAIP-19 id) as a
// human-readable chain name.
export function chainName(caip: string | undefined): string {
  if (!caip) return "unknown chain";
  return chainInfo(caip)?.name ?? caip2Of(caip);
}

// chainSlug is the short, lowercase chain name used in CLI arguments
// (e.g. "USDC-base").
export function chainSlug(caip: string): string {
  return chainName(caip).toLowerCase().replace(/\s+/g, "-");
}

export function txLink(caip: string, txHash: string | undefined): string {
  if (!txHash) return "(no tx hash)";
  const explorer = chainInfo(caip)?.explorer;
  return explorer ? `${explorer}${txHash}` : txHash;
}

// units converts raw on-chain units to a decimal number.
export function units(raw: string | bigint | undefined, decimals: number) {
  if (raw === undefined) return 0;
  return Number(BigInt(raw)) / 10 ** decimals;
}

// toRaw converts a decimal amount (e.g. "1.50") to raw on-chain units.
export function toRaw(amount: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = amount.trim().split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

// usd renders a dollar value.
export function usd(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "$?";
  const maxFrac = value !== 0 && Math.abs(value) < 0.01 ? 6 : 2;
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  })}`;
}

// pct renders an APY decimal fraction (e.g. "0.0432") as "4.32%".
export function pct(fraction: string | number | undefined): string {
  if (fraction === undefined || fraction === "") return "?%";
  return `${(Number(fraction) * 100).toFixed(2)}%`;
}

// The API returns rewardsApyPct on enabled vaults; the SDK types don't declare
// it yet.
export type EnabledVault = v1EarnEnabledVault & { rewardsApyPct?: string };

type VaultRates = {
  netApyPct?: string | undefined;
  rewardsApyPct?: string | undefined;
};

// A vault's netApyPct includes Merkl rewards, paid in separate tokens that
// reach the wallet only when someone claims them. This example doesn't claim
// them, so it ranks vaults by the yield it actually collects.
export function collectedApy(v: VaultRates): number | undefined {
  if (!v.netApyPct) return undefined;
  return Number(v.netApyPct) - Number(v.rewardsApyPct ?? 0);
}

// apyText shows the collected yield, plus any unclaimed reward rate beside it.
export function apyText(v: VaultRates): string {
  const rewards = Number(v.rewardsApyPct ?? 0);
  return (
    pct(collectedApy(v)) +
    (rewards > 0 ? ` (+${pct(rewards)} rewards, not claimed)` : "")
  );
}

// printPositions fetches and prints the wallet's Earn positions (in USD),
// labelled with the enabled-vault names, and returns them.
export async function printPositions(
  client: TurnkeyApiClient,
  organizationId: string,
  walletAddress: string,
  label: string,
): Promise<v1EarnPosition[]> {
  const [{ positions = [] }, { enabledVaults = [] }] = await Promise.all([
    client.listEarnPositions({ organizationId, walletAddress }),
    client.listEarnEnabledVaults({ organizationId }),
  ]);

  const vaultFor = (p: v1EarnPosition): EnabledVault | undefined =>
    enabledVaults.find(
      (v: v1EarnEnabledVault) =>
        v.wrapperAddress?.toLowerCase() === p.wrapperAddress?.toLowerCase(),
    );

  console.log(`📊 Positions ${label} (Earn wallet ${walletAddress}):`);
  if (positions.length === 0) {
    console.log("   (none)");
  }
  for (const p of positions) {
    const v = vaultFor(p);
    const name = v?.name ?? `${p.provider} vault`;
    console.log(
      `   ${C.bold}${name}${C.reset} on ${chainName(p.caip19)}, APY ${v ? apyText(v) : "?%"}`,
    );
    console.log(
      `     current value:    ${p.display?.currentValueUsd ? usd(Number(p.display.currentValueUsd)) : p.currentValue}`,
    );
  }

  return positions;
}
