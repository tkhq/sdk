/**
 * Parent-org setup for the scoped deposit session example.
 *
 * Creates the session profile whose scope allows exactly two things:
 * `USDC.approve(minibank, *)` and `MiniBank.deposit(*)`. Session profiles are
 * parent-org resources, immutable once created, so this script is idempotent:
 * it reuses a profile whose scope already matches instead of creating another.
 *
 * With `--interfaces` it also uploads the ERC-20 and MiniBank ABIs to the
 * parent org as smart contract interfaces. Whether the policy engine consults
 * a parent's interfaces when evaluating a sub-org's transaction is not
 * documented; the browser app uploads them into each sub-org regardless, so
 * this flag exists to test the question, not as a required step.
 *
 * If the org's root quorum is above 1, each create sits in CONSENSUS_NEEDED
 * until another root user approves it in the dashboard. The script prints the
 * activity id and polls until it completes.
 *
 * Reads `.env.local`: API_PUBLIC_KEY, API_PRIVATE_KEY, BASE_URL,
 * ORGANIZATION_ID. Prints the NEXT_PUBLIC_* lines to add for the app.
 */
import * as path from "path";
import * as dotenv from "dotenv";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import type { v1Activity, v1Result } from "@turnkey/sdk-types";
import {
  DEPOSIT_PROFILE_EXPIRATION_SECONDS,
  ERC20_ABI,
  MINIBANK_ABI,
  MINIBANK_ADDRESS,
  SCOPE_VARIANTS,
  USDC_ADDRESS,
  formatScope,
  normalizeScope,
  type ScopeVariant,
} from "../lib/config";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type ApiClient = ReturnType<TurnkeyServerSDK["apiClient"]>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The server SDK polls a submitted activity a few times, then hands back the
 * raw activity if it has not completed. For an org with a root quorum above 1
 * that is the normal case: the API key's vote is one of several. Keep polling
 * until it completes and pull the result out ourselves.
 */
async function awaitResult<T>(
  client: ApiClient,
  organizationId: string,
  activity: v1Activity,
  pick: (result: v1Result) => T | undefined,
): Promise<T> {
  let announced = false;
  let current = activity;

  for (;;) {
    switch (current.status) {
      case "ACTIVITY_STATUS_COMPLETED": {
        const value = current.result ? pick(current.result) : undefined;
        if (value === undefined) {
          throw new Error(`activity ${current.id} completed without a result`);
        }
        return value;
      }
      case "ACTIVITY_STATUS_CONSENSUS_NEEDED":
      case "ACTIVITY_STATUS_PENDING":
      case "ACTIVITY_STATUS_CREATED":
        if (!announced) {
          console.log(
            `  activity ${current.id} needs another approval.\n` +
              `  Approve it in the Turnkey dashboard; polling until it completes...`,
          );
          announced = true;
        }
        await sleep(3000);
        break;
      default:
        throw new Error(
          `activity ${current.id} ended as ${current.status}: ${JSON.stringify(
            current.failure,
          )}`,
        );
    }
    ({ activity: current } = await client.getActivity({
      activityId: current.id,
      organizationId,
    }));
  }
}

async function ensureSessionProfile(
  client: ApiClient,
  organizationId: string,
  variant: ScopeVariant,
): Promise<string> {
  const { name, build, notes } = SCOPE_VARIANTS[variant];
  const scope = build();

  const { sessionProfiles } = await client.getSessionProfiles({
    organizationId,
  });
  const existing = sessionProfiles.find(
    (p) => normalizeScope(p.scope) === normalizeScope(scope),
  );
  if (existing) {
    console.log(
      `session profile: reusing ${existing.sessionProfileId} (${existing.sessionProfileName})`,
    );
    if (existing.expirationSeconds !== DEPOSIT_PROFILE_EXPIRATION_SECONDS) {
      console.log(
        `  note: its expirationSeconds is ${existing.expirationSeconds ?? "unset"}, ` +
          `not ${DEPOSIT_PROFILE_EXPIRATION_SECONDS}. Profiles are immutable; ` +
          `change the scope text if you need a fresh one.`,
      );
    }
    return existing.sessionProfileId;
  }

  console.log(`session profile: creating "${name}"`);
  const res = await client.createSessionProfile({
    organizationId,
    sessionProfileName: name,
    scope,
    expirationSeconds: DEPOSIT_PROFILE_EXPIRATION_SECONDS,
    notes,
  });

  const sessionProfileId =
    res.sessionProfileId ||
    (await awaitResult(
      client,
      organizationId,
      res.activity,
      (r) => r.createSessionProfileResult?.sessionProfileId,
    ));

  console.log(`session profile: created ${sessionProfileId}`);
  return sessionProfileId;
}

async function ensureInterfaces(
  client: ApiClient,
  organizationId: string,
): Promise<void> {
  const wanted = [
    {
      label: "USDC (Base Sepolia)",
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      notes:
        "ERC-20 approve/transfer/balanceOf for the scoped deposit example.",
    },
    {
      label: "MiniBank (Base Sepolia)",
      address: MINIBANK_ADDRESS,
      abi: MINIBANK_ABI,
      notes: "deposit/withdraw for the scoped deposit example.",
    },
  ];

  const { smartContractInterfaces } = await client.getSmartContractInterfaces({
    organizationId,
  });

  for (const w of wanted) {
    const existing = smartContractInterfaces.find(
      (i) =>
        i.type === "SMART_CONTRACT_INTERFACE_TYPE_ETHEREUM" &&
        i.smartContractAddress.toLowerCase() === w.address,
    );
    if (existing) {
      console.log(
        `interface: reusing ${existing.smartContractInterfaceId} for ${w.label}`,
      );
      continue;
    }

    console.log(`interface: uploading ${w.label} at ${w.address}`);
    const res = await client.createSmartContractInterface({
      organizationId,
      label: w.label,
      notes: w.notes,
      type: "SMART_CONTRACT_INTERFACE_TYPE_ETHEREUM",
      smartContractAddress: w.address,
      smartContractInterface: JSON.stringify(w.abi),
    });
    const id =
      res.smartContractInterfaceId ||
      (await awaitResult(
        client,
        organizationId,
        res.activity,
        (r) => r.createSmartContractInterfaceResult?.smartContractInterfaceId,
      ));
    console.log(`interface: created ${id} for ${w.label}`);
  }
}

async function main() {
  const organizationId = requireEnv("ORGANIZATION_ID");
  const client = new TurnkeyServerSDK({
    apiBaseUrl: requireEnv("BASE_URL"),
    apiPublicKey: requireEnv("API_PUBLIC_KEY"),
    apiPrivateKey: requireEnv("API_PRIVATE_KEY"),
    defaultOrganizationId: organizationId,
  }).apiClient();

  // `--variant <name>` picks a scope from SCOPE_VARIANTS; default is the
  // two-branch approve+deposit scope the example is built around.
  const variantIdx = process.argv.indexOf("--variant");
  const variant = (
    variantIdx !== -1 ? process.argv[variantIdx + 1] : "approve+deposit"
  ) as ScopeVariant;
  if (!(variant in SCOPE_VARIANTS)) {
    throw new Error(
      `Unknown --variant "${variant}". Known: ${Object.keys(SCOPE_VARIANTS).join(", ")}`,
    );
  }

  console.log(`parent org: ${organizationId}`);
  console.log(`USDC:       ${USDC_ADDRESS}`);
  console.log(`MiniBank:   ${MINIBANK_ADDRESS}`);
  console.log(`variant:    ${variant}`);
  console.log(`scope:\n${formatScope(SCOPE_VARIANTS[variant].build())}\n`);

  if (process.argv.includes("--interfaces")) {
    await ensureInterfaces(client, organizationId);
    console.log();
  }

  const sessionProfileId = await ensureSessionProfile(
    client,
    organizationId,
    variant,
  );

  // Read it back so the output shows what Turnkey stored, not what we sent.
  const { sessionProfile } = await client.getSessionProfile({
    organizationId,
    sessionProfileId,
  });

  console.log(
    [
      ``,
      `Stored profile:`,
      `  id:         ${sessionProfile.sessionProfileId}`,
      `  name:       ${sessionProfile.sessionProfileName}`,
      `  expiration: ${sessionProfile.expirationSeconds ?? "(login decides)"}s`,
      `  scope:`,
      formatScope(sessionProfile.scope)
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n"),
      ``,
      `Add to .env.local:`,
      `NEXT_PUBLIC_SESSION_PROFILE_ID="${sessionProfile.sessionProfileId}"`,
      ``,
    ].join("\n"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
