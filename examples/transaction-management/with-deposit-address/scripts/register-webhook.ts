import * as path from "path";
import * as dotenv from "dotenv";
import { Turnkey } from "@turnkey/sdk-server";

// One-time setup: subscribe the parent organization's balance updates to this
// app's webhook route. Balance webhooks must be created in the parent
// (billing) organization, so this uses a parent-org API key, not the
// delegated key. Safe to run twice: an existing subscription is reused.

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const EVENT_TYPE = "BALANCE_CONFIRMED_UPDATES";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local.`);
  }
  return value;
}

async function main() {
  const organizationId = requireEnv("NEXT_PUBLIC_ORGANIZATION_ID");
  const url = requireEnv("WEBHOOK_URL");
  if (!url.startsWith("https://")) {
    throw new Error("WEBHOOK_URL must be a public https URL.");
  }

  const client = new Turnkey({
    apiBaseUrl:
      process.env.TURNKEY_API_BASE_URL?.trim() || "https://api.turnkey.com",
    apiPublicKey: requireEnv("TURNKEY_API_PUBLIC_KEY"),
    apiPrivateKey: requireEnv("TURNKEY_API_PRIVATE_KEY"),
    defaultOrganizationId: organizationId,
  }).apiClient();

  const { webhookEndpoints } = await client.listWebhookEndpoints({
    organizationId,
  });
  const existing = webhookEndpoints.find(
    (e) =>
      e.url === url && e.subscriptions?.some((s) => s.eventType === EVENT_TYPE),
  );
  if (existing) {
    console.log(
      `Already subscribed: endpoint ${existing.endpointId} -> ${url}` +
        (existing.isActive ? "" : " (inactive: enable it in the dashboard)"),
    );
    return;
  }

  const { endpointId } = await client.createWebhookEndpoint({
    organizationId,
    name: "Deposit address balance updates",
    url,
    subscriptions: [{ eventType: EVENT_TYPE }],
  });
  console.log(`Created endpoint ${endpointId}: ${EVENT_TYPE} -> ${url}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
