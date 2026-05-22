import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

const SUPPORTED_EVENT_TYPES = [
  "BALANCE_CONFIRMED_UPDATES",
  "SEND_TRANSACTION_STATUS_UPDATES",
] as const;

type EventType = (typeof SUPPORTED_EVENT_TYPES)[number];

function loadEnv() {
  const basePath = process.cwd();
  const envFiles = [".env", ".env.local"];

  for (const file of envFiles) {
    const envPath = path.resolve(basePath, file);
    if (fs.existsSync(envPath)) {
      dotenv.config({
        path: envPath,
        override: file === ".env.local",
      });
    }
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to your .env file.`);
  }

  return value;
}

async function main() {
  loadEnv();

  // EVENT_TYPE can be passed as an env var or as the first CLI argument
  const eventType: string =
    process.env.EVENT_TYPE?.trim() || process.argv[2] || "";

  if (!SUPPORTED_EVENT_TYPES.includes(eventType as EventType)) {
    throw new Error(
      `Invalid or missing EVENT_TYPE. Must be one of: ${SUPPORTED_EVENT_TYPES.join(", ")}.\n` +
        `Pass it via the EVENT_TYPE env var or as a CLI argument.`,
    );
  }

  const organizationId = requiredEnv("ORGANIZATION_ID");
  const apiPublicKey = requiredEnv("API_PUBLIC_KEY");
  const apiPrivateKey = requiredEnv("API_PRIVATE_KEY");
  const baseUrl = process.env.BASE_URL?.trim() || "https://api.turnkey.com";

  // Prefer event-specific env vars; fall back to generic WEBHOOK_URL / WEBHOOK_NAME
  const isBalance = eventType === "BALANCE_CONFIRMED_UPDATES";
  const webhookUrlEnvVar = isBalance
    ? "BALANCE_WEBHOOK_URL"
    : "TX_STATUS_WEBHOOK_URL";
  const webhookNameEnvVar = isBalance
    ? "BALANCE_WEBHOOK_NAME"
    : "TX_STATUS_WEBHOOK_NAME";

  const webhookUrl =
    process.env[webhookUrlEnvVar]?.trim() || requiredEnv("WEBHOOK_URL");
  const webhookName =
    process.env[webhookNameEnvVar]?.trim() ||
    process.env.WEBHOOK_NAME?.trim() ||
    `${eventType.toLowerCase().replace(/_/g, "-")}-${Date.now()}`;

  const turnkey = new TurnkeySDKServer({
    apiBaseUrl: baseUrl,
    apiPublicKey,
    apiPrivateKey,
    defaultOrganizationId: organizationId,
  });

  const response = await turnkey.apiClient().createWebhookEndpoint({
    organizationId,
    name: webhookName,
    url: webhookUrl,
    subscriptions: [
      {
        eventType,
      },
    ],
  });

  console.log(
    [
      "Webhook endpoint created.",
      `- Endpoint ID: ${response.endpointId}`,
      `- Name: ${response.webhookEndpoint?.name ?? webhookName}`,
      `- URL: ${response.webhookEndpoint?.url ?? webhookUrl}`,
      `- Subscription: ${eventType}`,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
