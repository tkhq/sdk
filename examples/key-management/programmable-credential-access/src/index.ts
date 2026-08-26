import * as dotenv from "dotenv";
import * as path from "path";
import {
  Turnkey,
  TurnkeyApiClient,
  TurnkeyRequestError,
} from "@turnkey/sdk-server";
import { generateP256KeyPair } from "@turnkey/crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Multi-agent consensus for credential access: a browser agent and a payment
// agent must both sign the same export before the enclave releases a stored
// credit card, and only the payment agent holds the decryption key.
// See https://docs.turnkey.com/solutions/key-management/programmable-credential-access
async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const apiBaseUrl = process.env.BASE_URL!;

  const rootClient = new Turnkey({
    apiBaseUrl,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  }).apiClient();

  // 1/ Model each agent role as a durable Turnkey user with its own API key.
  // In production these would be scoped, expiring session keys; a long-lived
  // API key keeps the example self-contained.
  const paymentAgentKeyPair = generateP256KeyPair();
  const browserAgentKeyPair = generateP256KeyPair();
  const suffix = Date.now();
  const { userIds } = await rootClient.createUsers({
    users: [
      {
        userName: `payment-agent-${suffix}`,
        apiKeys: [
          {
            apiKeyName: "payment-agent-key",
            publicKey: paymentAgentKeyPair.publicKey,
            curveType: "API_KEY_CURVE_P256",
          },
        ],
        authenticators: [],
        oauthProviders: [],
        userTags: [],
      },
      {
        userName: `browser-agent-${suffix}`,
        apiKeys: [
          {
            apiKeyName: "browser-agent-key",
            publicKey: browserAgentKeyPair.publicKey,
            curveType: "API_KEY_CURVE_P256",
          },
        ],
        authenticators: [],
        oauthProviders: [],
        userTags: [],
      },
    ],
  });
  const [paymentAgentUserId, browserAgentUserId] = userIds;
  console.log(
    `Created agent users: payment-agent (${paymentAgentUserId}), browser-agent (${browserAgentUserId})`,
  );

  const paymentAgent = new Turnkey({
    apiBaseUrl,
    apiPublicKey: paymentAgentKeyPair.publicKey,
    apiPrivateKey: paymentAgentKeyPair.privateKey,
    defaultOrganizationId: organizationId,
  }).apiClient();
  const browserAgent = new Turnkey({
    apiBaseUrl,
    apiPublicKey: browserAgentKeyPair.publicKey,
    apiPrivateKey: browserAgentKeyPair.privateKey,
    defaultOrganizationId: organizationId,
  }).apiClient();

  // 2/ Import the credential with static properties the consensus policy
  // targets. The plaintext is encrypted to the enclave on this machine.
  const card = JSON.stringify({
    number: "4242424242424242",
    exp: "11/29",
    cvv: "123",
  });
  const secretId = await rootClient.importSecret({
    plaintext: card,
    name: `corporate-visa-${suffix}`,
    staticProperties: {
      kind: "creditCard",
      requiresConsensus: "true",
    },
  });
  console.log(`Imported secret with id: ${secretId}`);

  // 3/ Require both agent roles to approve before the card is released.
  const { policyId } = await rootClient.createPolicy({
    policyName: `Require both agents for credit card access (${suffix})`,
    effect: "EFFECT_ALLOW",
    consensus:
      `approvers.any(u, u.id == '${paymentAgentUserId}') && ` +
      `approvers.any(u, u.id == '${browserAgentUserId}')`,
    condition:
      `secret.static_properties['requiresConsensus'] == 'true' && ` +
      `secret.static_properties['kind'] == 'creditCard' && ` +
      `activity.type == 'ACTIVITY_TYPE_EXPORT_SECRETS'`,
    notes: "Neither agent can retrieve the card alone",
  });
  console.log(`Created consensus policy with id: ${policyId}`);

  // 4/ The payment agent — the intended recipient — generates an ephemeral
  // keypair and builds the proposal locally (no network call). The proposal
  // contains no key material and can be shared with co-signers over any
  // channel.
  // The export activity requires a 65-byte uncompressed target key.
  const {
    privateKey: embeddedPrivateKey,
    publicKeyUncompressed: targetPublicKey,
  } = generateP256KeyPair();
  // The timestamp is part of the signed bytes, so every co-signer shares this
  // one value: the proposal is built once and passed around.
  const proposal = paymentAgent.createExportSecretsProposal({
    secrets: [{ secretId }],
    targetPublicKey,
    organizationId,
    timestampMs: String(Date.now()),
  });
  console.log(
    `Built export proposal with fingerprint: ${proposal.fingerprint}`,
  );

  // 5/ Both agents stamp and submit the byte-identical proposal in parallel.
  // Order doesn't matter: the first submission creates the activity and the
  // other registers as an approval vote. If the two submissions race to
  // create the activity, the loser gets a conflict error and its retry lands
  // as the approval.
  // The losing side of the race fails with gRPC ALREADY_EXISTS (code 6):
  // "an activity with the same fingerprint already exists". Only that error
  // is safe to retry; anything else (auth, validation, rate limits) is a
  // real failure.
  const isConflictError = (error: unknown) =>
    error instanceof TurnkeyRequestError && error.code === 6;
  const submitAsAgent = async (agent: TurnkeyApiClient, label: string) => {
    try {
      const result = await agent.submitExportSecrets(proposal);
      console.log(`${label} submitted: ${result.status}`);
      return result;
    } catch (error) {
      if (!isConflictError(error)) {
        throw error;
      }
      const result = await agent.submitExportSecrets(proposal);
      console.log(
        `${label} submitted (after conflict retry): ${result.status}`,
      );
      return result;
    }
  };
  const [paymentSubmission] = await Promise.all([
    submitAsAgent(paymentAgent, "payment-agent"),
    submitAsAgent(browserAgent, "browser-agent"),
  ]);

  // 6/ Consensus is satisfied, so the enclave re-encrypts the card to the
  // payment agent's ephemeral key. The browser agent approved the export but
  // cannot read the payload.
  const [exportedCard] = await paymentAgent.awaitExportedSecrets({
    proposal,
    embeddedPrivateKey,
    activityId: paymentSubmission.activityId,
  });
  if (exportedCard !== card) {
    throw new Error("Exported plaintext does not match the imported value");
  }
  console.log(`Payment agent decrypted the card after both approvals ✅`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
