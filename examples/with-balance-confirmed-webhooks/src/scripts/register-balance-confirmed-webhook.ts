import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

const BALANCE_CONFIRMED_EVENT = "BALANCE_CONFIRMED_UPDATES";

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

  const organizationId = requiredEnv("ORGANIZATION_ID");
  const apiPublicKey = requiredEnv("API_PUBLIC_KEY");
  const apiPrivateKey = requiredEnv("API_PRIVATE_KEY");
  const webhookUrl = requiredEnv("WEBHOOK_URL");
  const baseUrl = process.env.BASE_URL?.trim() || "https://api.turnkey.com";
  const webhookName =
    process.env.WEBHOOK_NAME?.trim() ||
    `balance-confirmed-webhook-${Date.now()}`;

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
        eventType: BALANCE_CONFIRMED_EVENT,
      },
    ],
  });

  console.log(
    [
      "Webhook endpoint created.",
      `- Endpoint ID: ${response.endpointId}`,
      `- Name: ${response.webhookEndpoint?.name ?? webhookName}`,
      `- URL: ${response.webhookEndpoint?.url ?? webhookUrl}`,
      `- Subscription: ${BALANCE_CONFIRMED_EVENT}`,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
