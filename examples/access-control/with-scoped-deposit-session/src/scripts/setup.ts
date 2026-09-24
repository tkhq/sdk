/**
 * Parent-org setup for the scoped deposit session example.
 *
 * Creates the one session profile the app logs into: `approve-and-deposit`,
 * whose scope allows `USDC.approve` with MiniBank as spender and
 * `MiniBank.deposit`, matched on raw calldata. Session profiles are
 * parent-org resources, immutable once created, so this script is
 * idempotent: it reuses a profile whose name and scope already match instead
 * of creating another.
 *
 * No smart contract interfaces are involved. The scope matches on raw
 * calldata (function selector, and the spender's bytes for approve), so
 * nothing has to be uploaded to the parent or to any sub-organization.
 *
 * If the org's root quorum is above 1, the create sits in CONSENSUS_NEEDED
 * until another root user approves it in the dashboard. The script prints the
 * activity id and polls until it completes.
 *
 * Reads `.env.local`: API_PUBLIC_KEY, API_PRIVATE_KEY, BASE_URL,
 * ORGANIZATION_ID. Prints the NEXT_PUBLIC_* line to add for the app.
 */
import * as path from "path";
import * as dotenv from "dotenv";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import type { v1Activity, v1Result } from "@turnkey/sdk-types";
import {
  MINIBANK_ADDRESS,
  PROFILE_ENV,
  PROFILE_EXPIRATION_SECONDS,
  PROFILE_NAME,
  PROFILE_NOTES,
  USDC_ADDRESS,
  buildScope,
  formatScope,
  normalizeScope,
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
): Promise<string> {
  const scope = buildScope();

  const { sessionProfiles } = await client.getSessionProfiles({
    organizationId,
  });
  const sameScope = sessionProfiles.filter(
    (p) => normalizeScope(p.scope) === normalizeScope(scope),
  );
  const existing = sameScope.find((p) => p.sessionProfileName === PROFILE_NAME);
  if (existing) {
    console.log(
      `session profile "${PROFILE_NAME}": reusing ${existing.sessionProfileId}`,
    );
    if (existing.expirationSeconds !== PROFILE_EXPIRATION_SECONDS) {
      console.log(
        `  note: its expirationSeconds is ${existing.expirationSeconds ?? "unset"}, ` +
          `not ${PROFILE_EXPIRATION_SECONDS}. Profiles are immutable; ` +
          `change PROFILE_NAME in src/lib/config.ts if you need a fresh one.`,
      );
    }
    return existing.sessionProfileId;
  }
  for (const p of sameScope) {
    console.log(
      `session profile "${PROFILE_NAME}": same scope exists under another name, ` +
        `${p.sessionProfileId} ("${p.sessionProfileName}"); creating a new one`,
    );
  }

  console.log(`session profile "${PROFILE_NAME}": creating`);
  const res = await client.createSessionProfile({
    organizationId,
    sessionProfileName: PROFILE_NAME,
    scope,
    expirationSeconds: PROFILE_EXPIRATION_SECONDS,
    notes: PROFILE_NOTES,
  });

  const sessionProfileId =
    res.sessionProfileId ||
    (await awaitResult(
      client,
      organizationId,
      res.activity,
      (r) => r.createSessionProfileResult?.sessionProfileId,
    ));

  console.log(`session profile "${PROFILE_NAME}": created ${sessionProfileId}`);
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

  console.log(`parent org: ${organizationId}`);
  console.log(`USDC:       ${USDC_ADDRESS}`);
  console.log(`MiniBank:   ${MINIBANK_ADDRESS}`);
  console.log(`expiration: ${PROFILE_EXPIRATION_SECONDS}s\n`);

  const sessionProfileId = await ensureSessionProfile(client, organizationId);

  // Read it back so the output shows what Turnkey stored, not what we sent.
  const { sessionProfile } = await client.getSessionProfile({
    organizationId,
    sessionProfileId,
  });

  console.log(
    [
      `  id:         ${sessionProfile.sessionProfileId}`,
      `  expiration: ${sessionProfile.expirationSeconds ?? "(login decides)"}s`,
      `  scope:`,
      formatScope(sessionProfile.scope)
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n"),
      ``,
      `Add to .env.local:`,
      `${PROFILE_ENV}="${sessionProfile.sessionProfileId}"`,
      ``,
    ].join("\n"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
