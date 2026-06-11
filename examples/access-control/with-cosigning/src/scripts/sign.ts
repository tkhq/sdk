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

  const [walletAddress, organizationId] = process.argv.slice(2);

  if (!walletAddress || !organizationId) {
    console.error(
      "Usage: pnpm sign <walletAddress> <organizationId>\n\n" +
        "  walletAddress  — Ethereum address of the wallet account to sign with\n" +
        "  organizationId — the sub-org ID (shown on the dashboard)\n\n" +
        "Example:\n" +
        "  pnpm sign 0xabc123... f5a6b7c8-...",
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

  const message = "Hello from the backend cosigner!";
  const payload = "0x" + Buffer.from(message).toString("hex");

  console.log(
    [
      "Submitting signing activity as cosigner (vote 1 of 2)…",
      `  Wallet  : ${walletAddress}`,
      `  Org     : ${organizationId}`,
      `  Message : ${message}`,
    ].join("\n"),
  );

  // With a 2-of-2 quorum the cosigner's vote alone is not enough to complete
  // the activity — it will land in CONSENSUS_NEEDED after polling exhausts.
  const res = await cosignerClient.apiClient().signRawPayload({
    organizationId,
    signWith: walletAddress,
    payload,
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
  });

  const activity = (res as any).activity;
  const status = activity?.status as string | undefined;
  const activityId = activity?.id as string | undefined;

  if (status === "ACTIVITY_STATUS_CONSENSUS_NEEDED" && activityId) {
    console.log(
      [
        "",
        "Activity is waiting for the user to approve (vote 2 of 2).",
        `  Activity ID : ${activityId}`,
        "",
        "Open the dashboard and click Approve on the pending activity.",
      ].join("\n"),
    );
  } else {
    console.log(`Unexpected activity status: ${status ?? "unknown"}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
