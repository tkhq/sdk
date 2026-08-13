import * as dotenv from "dotenv";
import * as path from "path";
import { Turnkey } from "@turnkey/sdk-server";
import { generateP256KeyPair } from "@turnkey/crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Store an exchange API key as a Turnkey secret, gate its retrieval with a
// policy, list the org's secrets, and retrieve the plaintext at runtime.
// See https://docs.turnkey.com/solutions/key-management/api-key-storage
async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const apiBaseUrl = process.env.BASE_URL!;
  const suffix = Date.now();

  const apiClient = new Turnkey({
    apiBaseUrl,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  }).apiClient();

  // 0/ Model the trading service as its own Turnkey user with its own API key,
  // so the example is self-contained and the retrieval below runs as a
  // non-root user that only the policy in step 2 authorizes. In production
  // these would be scoped, expiring session keys.
  const tradingServiceKeyPair = generateP256KeyPair();
  const { userIds } = await apiClient.createUsers({
    users: [
      {
        userName: `trading-service-${suffix}`,
        apiKeys: [
          {
            apiKeyName: "trading-service-key",
            publicKey: tradingServiceKeyPair.publicKey,
            curveType: "API_KEY_CURVE_P256",
          },
        ],
        authenticators: [],
        oauthProviders: [],
        userTags: [],
      },
    ],
  });
  const [userId] = userIds;
  console.log(`Created trading service user with id: ${userId}`);

  const tradingService = new Turnkey({
    apiBaseUrl,
    apiPublicKey: tradingServiceKeyPair.publicKey,
    apiPrivateKey: tradingServiceKeyPair.privateKey,
    defaultOrganizationId: organizationId,
  }).apiClient();

  // 1/ Import the credential. The plaintext is encrypted to a single-use
  // enclave target key on this machine; Turnkey's API and database only ever
  // see ciphertext. The static properties are bound immutably at import time
  // so policies can target classes of keys instead of individual IDs.
  const emsJwt = `demo-ems-jwt-${suffix}`;
  const secretId = await apiClient.importSecret({
    plaintext: emsJwt,
    name: `ems-trading-key-${suffix}`,
    staticProperties: {
      kind: "exchangeApiKey",
      permissions: "trade",
      environment: "production",
    },
  });
  console.log(`Imported secret with id: ${secretId}`);

  // 2/ Gate retrieval with a policy: only this service user may export
  // trade-only exchange keys.
  const { policyId } = await apiClient.createPolicy({
    policyName: `Trading service can retrieve trade-only exchange keys (${suffix})`,
    effect: "EFFECT_ALLOW",
    consensus: `approvers.any(u, u.id == '${userId}')`,
    condition:
      `secret.static_properties['kind'] == 'exchangeApiKey' && ` +
      `secret.static_properties['permissions'] == 'trade' && ` +
      `activity.type == 'ACTIVITY_TYPE_EXPORT_SECRETS'`,
    notes:
      "Scopes retrieval of trade-only exchange keys to the trading service",
  });
  console.log(`Created retrieval policy with id: ${policyId}`);

  // 3/ List the organization's secrets. Only metadata comes back; the
  // plaintext never leaves the enclave on this path.
  const secrets = await apiClient.getSecrets();
  console.log(`Organization has ${secrets.length} secret(s):`);
  for (const secret of secrets) {
    console.log(
      `- ${secret.secretId} (${secret.name ?? "<unnamed>"}) ${JSON.stringify(secret.staticProperties)}`,
    );
  }

  // 4/ Retrieve the credential at runtime, as the trading service user the
  // policy authorizes. exportSecret generates an ephemeral P-256 keypair,
  // submits the export activity, and decrypts the payload into this process's
  // memory only.
  const exported = await tradingService.exportSecret({ secretId });
  if (exported !== emsJwt) {
    throw new Error("Exported plaintext does not match the imported value");
  }
  console.log(`Exported secret plaintext matches the imported credential ✅`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
