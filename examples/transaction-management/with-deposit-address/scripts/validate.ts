import * as path from "path";
import * as dotenv from "dotenv";
import {
  encodeFunctionData,
  erc20Abi,
  parseGwei,
  serializeTransaction,
  type Address,
} from "viem";
import {
  BASE_SEPOLIA_CHAIN_ID,
  USDC_ADDRESS,
  parseAddress,
} from "@/lib/deposit";
import { serverEnv } from "@/server/env";
import {
  findDepositAddress,
  listDepositAddresses,
  type DepositAddressEntry,
} from "@/server/registry";
import { delegatedClient, type DelegatedClient } from "@/server/turnkey";

// The server modules read env lazily, so loading it here is early enough.
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Asks Turnkey to sign with the delegated key and reports what the policy
// engine allows. Nothing is broadcast: transactions are only signed.
//
//   pnpm validate             uses the most recently enabled deposit address
//   pnpm validate 0xabc...    uses that deposit address

type Outcome = "allowed" | "denied";
type Activity = { activity: { status: string; id: string } };
type Check = { label: string; expect: Outcome; run: () => Promise<Activity> };

function unsignedTx(to: Address, data?: `0x${string}`) {
  return serializeTransaction({
    type: "eip1559",
    chainId: BASE_SEPOLIA_CHAIN_ID,
    nonce: 0,
    to,
    value: data ? BigInt(0) : BigInt(1),
    data,
    gas: BigInt(100_000),
    maxFeePerGas: parseGwei("1"),
    maxPriorityFeePerGas: parseGwei("1"),
  });
}

function usdcTransfer(to: Address) {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, BigInt(1)],
  });
}

async function attempt(
  run: () => Promise<Activity>,
): Promise<{ outcome: Outcome; reason: string }> {
  try {
    const { activity } = await run();
    return activity.status === "ACTIVITY_STATUS_COMPLETED"
      ? { outcome: "allowed", reason: "" }
      : { outcome: "denied", reason: `activity ${activity.status}` };
  } catch (e) {
    return {
      outcome: "denied",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

async function target(arg: string | undefined): Promise<DepositAddressEntry> {
  if (arg) {
    const entry = await findDepositAddress(arg);
    if (!entry) throw new Error(`${arg} is not in data/deposit-addresses.json`);
    return entry;
  }
  const [latest] = await listDepositAddresses();
  if (!latest) {
    throw new Error(
      "No enabled deposit address yet. Log in, click Enable, then rerun.",
    );
  }
  return latest;
}

// Without this, a wrong key or sub-org id would look like "denied" and the
// run would pass for the wrong reason.
async function preflight(client: DelegatedClient, entry: DepositAddressEntry) {
  const { userId } = await client.getWhoami({
    organizationId: entry.subOrgId,
  });
  const { configs } = await client.getOrganizationConfigs({
    organizationId: entry.subOrgId,
  });
  if (configs.quorum?.userIds.includes(userId)) {
    throw new Error(`Delegated user ${userId} is root. Stop and fix this.`);
  }
  return userId;
}

async function main() {
  const entry = await target(process.argv[2]);
  const treasury = serverEnv.treasury;
  const elsewhere =
    parseAddress("0x000000000000000000000000000000000000dEaD") ?? treasury;
  const client = delegatedClient(entry.subOrgId);

  console.log(`Deposit address: ${entry.address}`);
  console.log(`Sub-org:         ${entry.subOrgId}`);
  const userId = await preflight(client, entry);
  console.log(`Delegated user:  ${userId} (authenticated, not root)\n`);

  const sign = (unsignedTransaction: string) => () =>
    client.signTransaction({
      organizationId: entry.subOrgId,
      signWith: entry.address,
      type: "TRANSACTION_TYPE_ETHEREUM",
      unsignedTransaction,
    });

  const checks: Check[] = [
    {
      label: `Send to treasury ${treasury}`,
      expect: "allowed",
      run: sign(unsignedTx(treasury)),
    },
    {
      label: `Send elsewhere ${elsewhere}`,
      expect: "denied",
      run: sign(unsignedTx(elsewhere)),
    },
    {
      label: "Sign a raw payload",
      expect: "denied",
      run: () =>
        client.signRawPayload({
          organizationId: entry.subOrgId,
          signWith: entry.address,
          payload: "deposit address validate",
          encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
          hashFunction: "HASH_FUNCTION_KECCAK256",
        }),
    },
    {
      label: "USDC transfer to treasury",
      expect: "allowed",
      run: sign(unsignedTx(USDC_ADDRESS, usdcTransfer(treasury))),
    },
    {
      label: "USDC transfer elsewhere",
      expect: "denied",
      run: sign(unsignedTx(USDC_ADDRESS, usdcTransfer(elsewhere))),
    },
  ];

  let failures = 0;
  for (const [i, check] of checks.entries()) {
    if (i === 3) console.log("\nUSDC branch of the same policy:");
    const { outcome, reason } = await attempt(check.run);
    const ok = outcome === check.expect;
    if (!ok) failures += 1;
    console.log(
      `${ok ? "✓" : "✗"} ${check.label}: ${outcome}` +
        (ok ? "" : ` (expected ${check.expect})`),
    );
    if (reason) console.log(`    ${reason}`);
  }

  console.log(
    failures === 0
      ? "\nAll checks match the policy."
      : `\n${failures} check(s) did not match.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
