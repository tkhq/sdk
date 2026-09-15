/**
 * Parent-org setup for the scoped deposit session example.
 *
 * Creates the two session profiles the app composes: `approve-only`
 * (`USDC.approve` with MiniBank as spender) and `deposit-only`
 * (`MiniBank.deposit`). Session profiles are parent-org resources, immutable
 * once created, so this script is idempotent: it reuses a profile whose name
 * and scope already match instead of creating another.
 *
 * Smart contract interfaces are NOT created here. The policy engine only
 * consults the interfaces of the organization whose transaction it is
 * evaluating, never the parent's, so the browser app uploads them into each
 * sub-organization at sign-up.
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
  MINIBANK_ADDRESS,
  PROFILE_ENV,
  PROFILE_EXPIRATION_SECONDS,
  SCOPE_VARIANTS,
  USDC_ADDRESS,
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
  const sameScope = sessionProfiles.filter(
    (p) => normalizeScope(p.scope) === normalizeScope(scope),
  );
  const existing = sameScope.find((p) => p.sessionProfileName === name);
  if (existing) {
    console.log(
      `session profile "${name}": reusing ${existing.sessionProfileId}`,
    );
    if (existing.expirationSeconds !== PROFILE_EXPIRATION_SECONDS) {
      console.log(
        `  note: its expirationSeconds is ${existing.expirationSeconds ?? "unset"}, ` +
          `not ${PROFILE_EXPIRATION_SECONDS}. Profiles are immutable; ` +
          `rename the variant if you need a fresh one.`,
      );
    }
    return existing.sessionProfileId;
  }
  for (const p of sameScope) {
    console.log(
      `session profile "${name}": same scope exists under another name, ` +
        `${p.sessionProfileId} ("${p.sessionProfileName}"); creating a new one`,
    );
  }

  console.log(`session profile "${name}": creating`);
  const res = await client.createSessionProfile({
    organizationId,
    sessionProfileName: name,
    scope,
    expirationSeconds: PROFILE_EXPIRATION_SECONDS,
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

  console.log(`session profile "${name}": created ${sessionProfileId}`);
  return sessionProfileId;
}

async function main() {
  const organizationId = requireEnv("ORGANIZATION_ID");
  const client = new TurnkeyServerSDK({
    apiBaseUrl: requireEnv("BASE_URL"),
    apiPublicKey: requireEnv("API_PUBLIC_KEY"),
    apiPrivateKey: requireEnv("API_PRIVATE_KEY"),
    defaultOrganizationId: organizationId,
  }).apiClient();

  // Both profiles by default; `--variant <name>` creates just one.
  const allVariants = Object.keys(SCOPE_VARIANTS) as ScopeVariant[];
  const variantIdx = process.argv.indexOf("--variant");
  let variants = allVariants;
  if (variantIdx !== -1) {
    const picked = process.argv[variantIdx + 1] as ScopeVariant;
    if (!(picked in SCOPE_VARIANTS)) {
      throw new Error(
        `Unknown --variant "${picked}". Known: ${allVariants.join(", ")}`,
      );
    }
    variants = [picked];
  }

  console.log(`parent org: ${organizationId}`);
  console.log(`USDC:       ${USDC_ADDRESS}`);
  console.log(`MiniBank:   ${MINIBANK_ADDRESS}`);
  console.log(`expiration: ${PROFILE_EXPIRATION_SECONDS}s`);
  console.log(`profiles:   ${variants.join(", ")}\n`);

  const envLines: string[] = [];
  for (const variant of variants) {
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
        `  id:         ${sessionProfile.sessionProfileId}`,
        `  expiration: ${sessionProfile.expirationSeconds ?? "(login decides)"}s`,
        `  scope:      ${normalizeScope(sessionProfile.scope)}`,
        ``,
      ].join("\n"),
    );
    envLines.push(
      `${PROFILE_ENV[variant]}="${sessionProfile.sessionProfileId}"`,
    );
  }

  console.log(["Add to .env.local:", ...envLines, ""].join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
