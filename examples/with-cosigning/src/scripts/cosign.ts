import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: file === ".env.local" });
    }
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`Missing ${name}. Add it to your .env.local file.`);
  return value;
}

async function main() {
  loadEnv();

  const [activityId, organizationId] = process.argv.slice(2);

  if (!activityId || !organizationId) {
    console.error(
      "Usage: pnpm cosign <activityId> <organizationId>\n\n" +
        "  activityId     — copy from the dashboard pending state\n" +
        "  organizationId — the sub-org ID shown on the dashboard\n\n" +
        "Example:\n" +
        "  pnpm cosign e4b1c2d3-... f5a6b7c8-...",
    );
    process.exit(1);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://api.turnkey.com";

  const cosignerClient = new TurnkeyServerSDK({
    apiBaseUrl: baseUrl,
    apiPublicKey: requiredEnv("COSIGNER_API_PUBLIC_KEY"),
    apiPrivateKey: requiredEnv("COSIGNER_API_PRIVATE_KEY"),
    defaultOrganizationId: organizationId,
  });

  // Fetch activity first so we can show what we're approving
  const { activity } = await cosignerClient.apiClient().getActivity({
    organizationId,
    activityId,
  });

  if (activity.status !== "ACTIVITY_STATUS_CONSENSUS_NEEDED") {
    console.error(
      `Activity is not pending cosigner approval.\n` +
        `  Status: ${activity.status}\n` +
        `  ID    : ${activityId}`,
    );
    process.exit(1);
  }

  console.log(
    [
      "Activity pending approval:",
      `  ID     : ${activity.id}`,
      `  Type   : ${activity.type}`,
      `  Org    : ${organizationId}`,
      `  Votes  : ${activity.votes?.length ?? 0} so far`,
      "",
      "Approving…",
    ].join("\n"),
  );

  await cosignerClient.apiClient().approveActivity({
    fingerprint: activity.fingerprint,
  });

  console.log(
    "Activity approved. The browser should update automatically via SSE.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
