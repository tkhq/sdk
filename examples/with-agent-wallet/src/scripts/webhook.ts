import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

const ACTIVITY_UPDATES_EVENT = "ACTIVITY_UPDATES";

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

  const command = process.argv[2];

  if (command !== "-register" && command !== "-update") {
    console.error(
      "Usage:\n" +
        "  pnpm webhook -register   Create a new webhook endpoint\n" +
        "  pnpm webhook -update     Update the URL of the first existing endpoint (useful after ngrok restart)",
    );
    process.exit(1);
  }

  const organizationId = requiredEnv("NEXT_PUBLIC_ORGANIZATION_ID");
  const apiPublicKey = requiredEnv("API_PUBLIC_KEY");
  const apiPrivateKey = requiredEnv("API_PRIVATE_KEY");
  const webhookUrl = requiredEnv("WEBHOOK_URL");
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://api.turnkey.com";

  const turnkey = new TurnkeyServerSDK({
    apiBaseUrl: baseUrl,
    apiPublicKey,
    apiPrivateKey,
    defaultOrganizationId: organizationId,
  });

  if (command === "-register") {
    const webhookName =
      process.env.WEBHOOK_NAME?.trim() || `agent-wallet-webhook-${Date.now()}`;

    const response = await turnkey.apiClient().createWebhookEndpoint({
      organizationId,
      name: webhookName,
      url: webhookUrl,
      subscriptions: [{ eventType: ACTIVITY_UPDATES_EVENT }],
    });

    console.log(
      [
        "Webhook endpoint registered.",
        `- Endpoint ID : ${response.endpointId}`,
        `- Name        : ${response.webhookEndpoint?.name ?? webhookName}`,
        `- URL         : ${response.webhookEndpoint?.url ?? webhookUrl}`,
        `- Subscription: ${ACTIVITY_UPDATES_EVENT}`,
        "",
        "All ACTIVITY_UPDATES events will now be delivered to your webhook.",
        "Run `pnpm agent <scenario> <address> <orgId>` to trigger signing.",
      ].join("\n"),
    );
  } else {
    const { webhookEndpoints } = await turnkey
      .apiClient()
      .listWebhookEndpoints({ organizationId });

    if (!webhookEndpoints.length) {
      console.error(
        "No existing webhook endpoints found. Run `pnpm webhook -register` first.",
      );
      process.exit(1);
    }

    const endpoint = webhookEndpoints[0];
    await turnkey.apiClient().updateWebhookEndpoint({
      organizationId,
      endpointId: endpoint.endpointId,
      url: webhookUrl,
    });

    console.log(
      [
        "Webhook endpoint updated.",
        `- Endpoint ID : ${endpoint.endpointId}`,
        `- New URL     : ${webhookUrl}`,
      ].join("\n"),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
