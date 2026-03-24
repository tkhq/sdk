import type {
  CreateAgentSessionRequest,
  CreateAgentSessionResult,
  AgentAccountResult,
} from "./types";
import { defaultSigningPolicy, resolvePolicyPlaceholders } from "./policies";

/**
 * Provision a complete isolated agent identity in 4-5 API calls.
 *
 * Two-key pattern: The Turnkey Notarizer requires every user to have at least
 * one non-expiring API key. We satisfy this by creating an "anchor" key
 * (non-expiring, private key discarded) on the agent user, then adding a
 * separate "session" key (expiring, given to the agent). This way
 * expirationSeconds is enforced by the enclave, not just advisory.
 *
 * Creates a sub-organization with:
 * - A root admin user (orchestrator credential, non-expiring, discarded after provisioning)
 * - A non-root agent user with an anchor key (non-expiring, satisfies Notarizer)
 * - A session key on the agent user (expiring, given to agent)
 * - Optional wallet accounts for signing
 * - ALLOW policies scoped to the agent user (implicit deny for everything else)
 *
 * The agent's non-root credential goes through full UMP policy evaluation
 * in the enclave. Root quorum bypass does not apply to non-root users.
 *
 * @param parentClient - TurnkeyApiClient authenticated as the parent org (return value of TurnkeyServerSDK.apiClient())
 * @param request - Agent session configuration
 * @param options - Optional configuration (e.g., apiBaseUrl override)
 * @returns Complete agent identity including API key, wallet accounts, and policy IDs
 */
export async function createAgentSession(
  parentClient: {
    createSubOrganization: Function;
    deleteSubOrganization: Function;
    [key: string]: any;
  },
  request: CreateAgentSessionRequest,
  options?: { apiBaseUrl?: string },
): Promise<CreateAgentSessionResult> {
  const { generateP256KeyPair } = await import("@turnkey/crypto");

  // Step 1: Generate three P256 key pairs
  const adminKeyPair = generateP256KeyPair();
  const agentAnchorKeyPair = generateP256KeyPair();
  const agentSessionKeyPair = generateP256KeyPair();

  // Step 1b: Build sub-org name with optional delegation suffix (blended identity)
  const delegationSuffix = request.delegatedBy
    ? ` [delegated:${request.delegatedBy.email ?? request.delegatedBy.userId ?? "unknown"}]`
    : "";
  const subOrgName = `${request.agentName}${delegationSuffix}`;

  // Step 2: Build wallet accounts from request
  const walletAccounts = (request.accounts ?? []).map((account, i) => ({
    curve: account.curve,
    pathFormat: account.pathFormat ?? "PATH_FORMAT_BIP32",
    path: account.path ?? `m/44'/1'/${i}'/0/0`,
    addressFormat: account.addressFormat ?? "ADDRESS_FORMAT_COMPRESSED",
  }));

  const walletParams =
    walletAccounts.length > 0
      ? {
          walletName: `${request.agentName}-keys`,
          accounts: walletAccounts,
        }
      : undefined;

  // Step 3: Create sub-organization (as parent org)
  // SDK methods destructure {organizationId, timestampMs, ...rest} and wrap rest as parameters
  const subOrgResponse = await parentClient.createSubOrganization({
    organizationId: request.organizationId,
    subOrganizationName: subOrgName,
    rootUsers: [
      {
        userName: `${request.agentName}-admin`,
        apiKeys: [
          {
            apiKeyName: `${request.agentName}-admin-key`,
            publicKey: adminKeyPair.publicKey,
            curveType: "API_KEY_CURVE_P256",
            // Note: no expirationSeconds here. The Notarizer requires at least one
            // "long-lived" credential (no expiration) per user for validation.
            // The admin key is discarded after provisioning and the sub-org can be
            // deleted to revoke it.
          },
        ],
        authenticators: [],
        oauthProviders: [],
      },
    ],
    rootQuorumThreshold: 1,
    wallet: walletParams,
    disableEmailRecovery: true,
    disableEmailAuth: true,
    disableSmsAuth: true,
    disableOtpEmailAuth: true,
  });

  // Response has result fields spread directly (e.g., subOrganizationId, wallet, rootUserIds)
  const subOrgId: string = subOrgResponse.subOrganizationId;
  const walletId: string | undefined = subOrgResponse.wallet?.walletId;
  // wallet.addresses is string[] (address strings, not objects)
  const walletAddresses: string[] = subOrgResponse.wallet?.addresses ?? [];

  // Helper to clean up sub-org on failure
  const cleanup = async () => {
    try {
      // To delete a sub-org, call deleteSubOrganization with the sub-org as the organizationId
      await parentClient.deleteSubOrganization({
        organizationId: subOrgId,
        deleteWithoutExport: true,
      });
    } catch {
      // Best-effort cleanup
    }
  };

  // Step 4: Create sub-org admin client (as root admin)
  const sdkServer = await import("@turnkey/sdk-server");
  const TurnkeyServerSDK =
    (sdkServer as any).TurnkeyServerSDK ?? (sdkServer as any).Turnkey;

  const apiBaseUrl = options?.apiBaseUrl ?? "https://api.turnkey.com";

  const subOrgSdk = new TurnkeyServerSDK({
    apiBaseUrl,
    apiPublicKey: adminKeyPair.publicKey,
    apiPrivateKey: adminKeyPair.privateKey,
    defaultOrganizationId: subOrgId,
  });

  const subOrgClient = subOrgSdk.apiClient();

  // Step 5: Create non-root agent user with anchor key (as root admin)
  // The anchor key satisfies the Notarizer's requirement for a non-expiring credential.
  // Its private key is never stored or returned.
  let agentUserId: string;
  try {
    const createUsersResponse = await subOrgClient.createUsers({
      organizationId: subOrgId,
      users: [
        {
          userName: request.agentName,
          userTags: [],
          apiKeys: [
            {
              apiKeyName: `${request.agentName}-anchor-key`,
              publicKey: agentAnchorKeyPair.publicKey,
              curveType: "API_KEY_CURVE_P256",
              // No expirationSeconds: this anchor key satisfies the Notarizer's
              // requirement for at least one non-expiring credential per user.
              // The private key is discarded; the anchor exists only to keep
              // the user valid while the session key handles actual auth.
            },
          ],
          authenticators: [],
          oauthProviders: [],
        },
      ],
    });

    // Result fields are spread onto response: userIds is directly accessible
    const userId = createUsersResponse.userIds?.[0];
    if (!userId) {
      await cleanup();
      throw new Error("Failed to create agent user: no user ID returned");
    }
    agentUserId = userId;
  } catch (err) {
    if ((err as Error).message?.includes("Failed to create agent user")) {
      throw err;
    }
    await cleanup();
    throw new Error(
      `Failed to create agent user: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Step 5b: Create expiring session key on the agent user
  // This is the key the agent will actually use. It expires per request.expirationSeconds.
  try {
    await subOrgClient.createApiKeys({
      organizationId: subOrgId,
      userId: agentUserId,
      apiKeys: [
        {
          apiKeyName: `${request.agentName}-session-key`,
          publicKey: agentSessionKeyPair.publicKey,
          curveType: "API_KEY_CURVE_P256",
          expirationSeconds: String(request.expirationSeconds),
        },
      ],
    });
  } catch (err) {
    await cleanup();
    throw new Error(
      `Failed to create session key: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Step 6: Create policies (as root admin)
  // Dedup: skip default signing policy if user already provides one that covers sign_raw_payload
  const userPolicies = resolvePolicyPlaceholders(
    request.policies ?? [],
    agentUserId,
  );
  const userCoversSignRawPayload = userPolicies.some(
    (p) =>
      p.condition?.includes("ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2") ||
      p.condition?.includes("ACTIVITY_TYPE_SIGN_RAW_PAYLOAD"),
  );
  const defaultPolicies = userCoversSignRawPayload
    ? []
    : [defaultSigningPolicy(agentUserId)];
  const allPolicies = [...defaultPolicies, ...userPolicies];

  let policyIds: string[] = [];
  try {
    const policyResponse = await subOrgClient.createPolicies({
      organizationId: subOrgId,
      policies: allPolicies.map((p) => ({
        policyName: p.policyName,
        effect: p.effect,
        condition: p.condition,
        consensus: p.consensus,
        notes: "",
      })),
    });

    // policyIds spread directly onto response
    policyIds = policyResponse.policyIds ?? [];
  } catch (err) {
    await cleanup();
    throw new Error(
      `Failed to create policies: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Step 7: Export wallet accounts if requested (as root admin)
  const accounts: AgentAccountResult[] = [];
  const requestAccounts = request.accounts ?? [];

  for (let i = 0; i < requestAccounts.length; i++) {
    const config = requestAccounts[i]!;
    const address = walletAddresses[i]; // string (the address itself)

    const accountResult: AgentAccountResult = {
      label: config.label,
      publicKey: address ?? "",
      walletId: walletId ?? "",
      addressId: address ?? "", // address string serves as identifier
      curve: config.curve,
    };

    if (config.exportKey && walletId && address) {
      try {
        const exportResponse = await subOrgClient.exportWalletAccount({
          organizationId: subOrgId,
          address: address,
          targetPublicKey:
            agentSessionKeyPair.publicKeyUncompressed ??
            agentSessionKeyPair.publicKey,
        });

        // exportBundle spread directly onto response
        accountResult.exportBundle = exportResponse.exportBundle;
      } catch {
        // Export failure is non-fatal; the account still exists
        // Callers can detect missing exportBundle to know export failed
      }
    }

    accounts.push(accountResult);
  }

  // Step 8: Return result (admin key retained for session deletion, anchor key discarded)
  const expiresAt = new Date(
    Date.now() + request.expirationSeconds * 1000,
  ).toISOString();

  return {
    subOrganizationId: subOrgId,
    agentUserId,
    apiKey: {
      publicKey: agentSessionKeyPair.publicKey,
      privateKey: agentSessionKeyPair.privateKey,
    },
    adminApiKey: {
      publicKey: adminKeyPair.publicKey,
      privateKey: adminKeyPair.privateKey,
    },
    accounts,
    policyIds,
    expiresAt,
    ...(request.delegatedBy ? { delegatedBy: request.delegatedBy } : {}),
  };
}
