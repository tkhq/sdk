import { createAgentSession } from "../create-session";
import { gitSigning, jwtSigning, ethSigning } from "../presets";

// Mock @turnkey/crypto
const mockGenerateP256KeyPair = jest.fn();
jest.mock("@turnkey/crypto", () => ({
  generateP256KeyPair: (...args: any[]) => mockGenerateP256KeyPair(...args),
}));

// Mock @turnkey/sdk-server
const mockSubOrgApiClient = {
  createUsers: jest.fn(),
  createApiKeys: jest.fn(),
  createPolicies: jest.fn(),
  exportWalletAccount: jest.fn(),
  deleteSubOrganization: jest.fn(),
};

const mockTurnkeyServerSDK = jest.fn().mockImplementation(function (
  this: any,
  config: any,
) {
  this.config = config;
  this.apiClient = () => mockSubOrgApiClient;
});

jest.mock("@turnkey/sdk-server", () => ({
  TurnkeyServerSDK: mockTurnkeyServerSDK,
}));

// Mock parent client (authenticated as parent org)
const mockParentClient = {
  createSubOrganization: jest.fn(),
  deleteSubOrganization: jest.fn(),
};

// Test key pairs
const ADMIN_KEY_PAIR = {
  privateKey: "admin-private-key-hex",
  publicKey: "admin-public-key-hex",
  publicKeyUncompressed: "admin-public-key-uncompressed-hex",
};

const AGENT_ANCHOR_KEY_PAIR = {
  privateKey: "agent-anchor-private-key-hex",
  publicKey: "agent-anchor-public-key-hex",
  publicKeyUncompressed: "agent-anchor-public-key-uncompressed-hex",
};

const AGENT_SESSION_KEY_PAIR = {
  privateKey: "agent-session-private-key-hex",
  publicKey: "agent-session-public-key-hex",
  publicKeyUncompressed: "agent-session-public-key-uncompressed-hex",
};

beforeEach(() => {
  jest.clearAllMocks();

  // Default: generateP256KeyPair returns admin first, then anchor, then session
  let callCount = 0;
  mockGenerateP256KeyPair.mockImplementation(() => {
    callCount++;
    if (callCount === 1) return ADMIN_KEY_PAIR;
    if (callCount === 2) return AGENT_ANCHOR_KEY_PAIR;
    return AGENT_SESSION_KEY_PAIR;
  });

  // Default successful responses
  mockParentClient.createSubOrganization.mockResolvedValue({
    subOrganizationId: "sub-org-123",
    rootUserIds: ["root-user-456"],
    wallet: {
      walletId: "wallet-789",
      addresses: ["0xaddr1", "0xaddr2"],
    },
    activity: {
      id: "activity-1",
      status: "ACTIVITY_STATUS_COMPLETED",
    },
  });

  mockSubOrgApiClient.createUsers.mockResolvedValue({
    userIds: ["agent-user-001"],
    activity: {
      id: "activity-2",
      status: "ACTIVITY_STATUS_COMPLETED",
    },
  });

  mockSubOrgApiClient.createApiKeys.mockResolvedValue({
    apiKeyIds: ["session-key-id"],
    activity: {
      id: "activity-2b",
      status: "ACTIVITY_STATUS_COMPLETED",
    },
  });

  mockSubOrgApiClient.createPolicies.mockResolvedValue({
    policyIds: ["policy-aaa", "policy-bbb"],
    activity: {
      id: "activity-3",
      status: "ACTIVITY_STATUS_COMPLETED",
    },
  });

  mockSubOrgApiClient.exportWalletAccount.mockResolvedValue({
    exportBundle: "encrypted-key-bundle-base64",
    activity: {
      id: "activity-4",
      status: "ACTIVITY_STATUS_COMPLETED",
    },
  });
});

describe("createAgentSession", () => {
  const baseRequest = {
    organizationId: "parent-org-id",
    agentName: "test-agent",
    expirationSeconds: 3600,
  };

  describe("happy path with accounts", () => {
    it("orchestrates sub-org creation, user creation, session key, and policy creation", async () => {
      const result = await createAgentSession(mockParentClient, {
        ...baseRequest,
        accounts: [jwtSigning(), gitSigning()],
      });

      // Verify sub-org creation called with flat params (no nested parameters)
      expect(mockParentClient.createSubOrganization).toHaveBeenCalledTimes(1);
      const subOrgArgs =
        mockParentClient.createSubOrganization.mock.calls[0][0];
      expect(subOrgArgs.organizationId).toBe("parent-org-id");
      expect(subOrgArgs.subOrganizationName).toBe("test-agent");
      expect(subOrgArgs.rootQuorumThreshold).toBe(1);
      expect(subOrgArgs.disableEmailRecovery).toBe(true);
      expect(subOrgArgs.disableEmailAuth).toBe(true);
      expect(subOrgArgs.disableSmsAuth).toBe(true);
      expect(subOrgArgs.disableOtpEmailAuth).toBe(true);
      // No nested "parameters" key
      expect(subOrgArgs.parameters).toBeUndefined();

      // Verify root user has admin key (no expiration, required by Notarizer)
      expect(subOrgArgs.rootUsers).toHaveLength(1);
      expect(subOrgArgs.rootUsers[0].apiKeys[0].publicKey).toBe(
        ADMIN_KEY_PAIR.publicKey,
      );
      expect(
        subOrgArgs.rootUsers[0].apiKeys[0].expirationSeconds,
      ).toBeUndefined();
      expect(subOrgArgs.rootUsers[0].apiKeys[0].curveType).toBe(
        "API_KEY_CURVE_P256",
      );

      // Verify wallet has both accounts
      expect(subOrgArgs.wallet.accounts).toHaveLength(2);
      expect(subOrgArgs.wallet.accounts[0].curve).toBe("CURVE_P256");
      expect(subOrgArgs.wallet.accounts[1].curve).toBe("CURVE_ED25519");

      // Verify createUsers called with anchor key (no expirationSeconds)
      expect(mockSubOrgApiClient.createUsers).toHaveBeenCalledTimes(1);
      const usersArgs = mockSubOrgApiClient.createUsers.mock.calls[0][0];
      expect(usersArgs.organizationId).toBe("sub-org-123");
      expect(usersArgs.users).toHaveLength(1);
      expect(usersArgs.users[0].userName).toBe("test-agent");
      expect(usersArgs.users[0].apiKeys[0].publicKey).toBe(
        AGENT_ANCHOR_KEY_PAIR.publicKey,
      );
      expect(usersArgs.users[0].apiKeys[0].expirationSeconds).toBeUndefined();
      // No nested "parameters" key
      expect(usersArgs.parameters).toBeUndefined();

      // Verify createApiKeys called with session key (with expirationSeconds)
      expect(mockSubOrgApiClient.createApiKeys).toHaveBeenCalledTimes(1);
      const apiKeysArgs = mockSubOrgApiClient.createApiKeys.mock.calls[0][0];
      expect(apiKeysArgs.organizationId).toBe("sub-org-123");
      expect(apiKeysArgs.userId).toBe("agent-user-001");
      expect(apiKeysArgs.apiKeys).toHaveLength(1);
      expect(apiKeysArgs.apiKeys[0].publicKey).toBe(
        AGENT_SESSION_KEY_PAIR.publicKey,
      );
      expect(apiKeysArgs.apiKeys[0].expirationSeconds).toBe("3600");
      expect(apiKeysArgs.apiKeys[0].curveType).toBe("API_KEY_CURVE_P256");

      // Verify createPolicies called with default signing policy
      expect(mockSubOrgApiClient.createPolicies).toHaveBeenCalledTimes(1);
      const policiesArgs = mockSubOrgApiClient.createPolicies.mock.calls[0][0];
      expect(policiesArgs.organizationId).toBe("sub-org-123");
      expect(policiesArgs.policies).toHaveLength(1);
      expect(policiesArgs.policies[0].policyName).toBe(
        "allow-sign-raw-payload",
      );
      expect(policiesArgs.policies[0].effect).toBe("EFFECT_ALLOW");
      expect(policiesArgs.policies[0].notes).toBe("");
      expect(policiesArgs.policies[0].consensus).toContain("agent-user-001");
      // No nested "parameters" key
      expect(policiesArgs.parameters).toBeUndefined();

      // Verify result uses session key (not anchor)
      expect(result.subOrganizationId).toBe("sub-org-123");
      expect(result.agentUserId).toBe("agent-user-001");
      expect(result.apiKey.publicKey).toBe(AGENT_SESSION_KEY_PAIR.publicKey);
      expect(result.apiKey.privateKey).toBe(AGENT_SESSION_KEY_PAIR.privateKey);
      expect(result.adminApiKey.publicKey).toBe(ADMIN_KEY_PAIR.publicKey);
      expect(result.adminApiKey.privateKey).toBe(ADMIN_KEY_PAIR.privateKey);
      expect(result.accounts).toHaveLength(2);
      expect(result.policyIds).toEqual(["policy-aaa", "policy-bbb"]);
      expect(result.expiresAt).toBeDefined();
    });
  });

  describe("happy path without accounts", () => {
    it("creates sub-org without wallet", async () => {
      mockParentClient.createSubOrganization.mockResolvedValue({
        subOrganizationId: "sub-org-123",
        rootUserIds: ["root-user-456"],
        activity: { id: "activity-1", status: "ACTIVITY_STATUS_COMPLETED" },
      });

      const result = await createAgentSession(mockParentClient, baseRequest);

      const subOrgArgs =
        mockParentClient.createSubOrganization.mock.calls[0][0];
      expect(subOrgArgs.wallet).toBeUndefined();
      expect(result.accounts).toEqual([]);
    });
  });

  describe("custom policies with placeholder", () => {
    it("replaces <AGENT_USER_ID> placeholder with actual user ID", async () => {
      await createAgentSession(mockParentClient, {
        ...baseRequest,
        policies: [
          {
            policyName: "custom-policy",
            effect: "EFFECT_ALLOW",
            condition: "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2'",
            consensus: "approvers.any(user, user.id == '<AGENT_USER_ID>')",
          },
        ],
      });

      const policiesArgs = mockSubOrgApiClient.createPolicies.mock.calls[0][0];
      // Default + custom = 2 policies
      expect(policiesArgs.policies).toHaveLength(2);
      // Custom policy should have real user ID
      expect(policiesArgs.policies[1].consensus).toBe(
        "approvers.any(user, user.id == 'agent-user-001')",
      );
      expect(policiesArgs.policies[1].consensus).not.toContain(
        "<AGENT_USER_ID>",
      );
    });
  });

  describe("error handling: createUsers fails", () => {
    it("triggers cleanup and throws", async () => {
      mockSubOrgApiClient.createUsers.mockRejectedValue(
        new Error("user creation failed"),
      );

      await expect(
        createAgentSession(mockParentClient, baseRequest),
      ).rejects.toThrow("Failed to create agent user");

      // Verify cleanup was attempted
      expect(mockParentClient.deleteSubOrganization).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling: createApiKeys failure triggers cleanup", () => {
    it("triggers cleanup and throws when session key creation fails", async () => {
      mockSubOrgApiClient.createApiKeys.mockRejectedValue(
        new Error("api key creation failed"),
      );

      await expect(
        createAgentSession(mockParentClient, baseRequest),
      ).rejects.toThrow("Failed to create session key");

      // Verify cleanup was attempted
      expect(mockParentClient.deleteSubOrganization).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling: createPolicies fails", () => {
    it("triggers cleanup and throws", async () => {
      mockSubOrgApiClient.createPolicies.mockRejectedValue(
        new Error("policy creation failed"),
      );

      await expect(
        createAgentSession(mockParentClient, baseRequest),
      ).rejects.toThrow("Failed to create policies");

      // Verify cleanup was attempted
      expect(mockParentClient.deleteSubOrganization).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling: createSubOrganization failure propagates without cleanup", () => {
    it("does not call deleteSubOrganization when createSubOrganization throws", async () => {
      mockParentClient.createSubOrganization.mockRejectedValue(
        new Error("sub-org creation failed"),
      );

      await expect(
        createAgentSession(mockParentClient, baseRequest),
      ).rejects.toThrow("sub-org creation failed");

      // No cleanup because sub-org was never created
      expect(mockParentClient.deleteSubOrganization).not.toHaveBeenCalled();
    });
  });

  describe("error handling: createUsers returns empty userIds triggers cleanup", () => {
    it("cleans up and throws when no user ID returned", async () => {
      mockSubOrgApiClient.createUsers.mockResolvedValue({
        userIds: [],
        activity: { id: "activity-2", status: "ACTIVITY_STATUS_COMPLETED" },
      });

      await expect(
        createAgentSession(mockParentClient, baseRequest),
      ).rejects.toThrow("Failed to create agent user: no user ID returned");

      expect(mockParentClient.deleteSubOrganization).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling: cleanup failure is swallowed, original error surfaces", () => {
    it("surfaces the original error even when cleanup also fails", async () => {
      mockSubOrgApiClient.createUsers.mockRejectedValue(
        new Error("original user error"),
      );
      mockParentClient.deleteSubOrganization.mockRejectedValue(
        new Error("cleanup also failed"),
      );

      await expect(
        createAgentSession(mockParentClient, baseRequest),
      ).rejects.toThrow("Failed to create agent user: original user error");

      // Cleanup was attempted
      expect(mockParentClient.deleteSubOrganization).toHaveBeenCalledTimes(1);
    });
  });

  describe("edge case: policyIds undefined returns empty array", () => {
    it("returns empty policyIds when createPolicies returns undefined", async () => {
      mockSubOrgApiClient.createPolicies.mockResolvedValue({
        policyIds: undefined,
        activity: { id: "activity-3", status: "ACTIVITY_STATUS_COMPLETED" },
      });

      const result = await createAgentSession(mockParentClient, baseRequest);

      expect(result.policyIds).toEqual([]);
    });
  });

  describe("edge case: apiBaseUrl override passed to sub-org SDK", () => {
    it("passes custom apiBaseUrl to TurnkeyServerSDK", async () => {
      await createAgentSession(mockParentClient, baseRequest, {
        apiBaseUrl: "https://custom-api.example.com",
      });

      expect(mockTurnkeyServerSDK).toHaveBeenCalledTimes(1);
      const sdkConfig = mockTurnkeyServerSDK.mock.calls[0][0];
      expect(sdkConfig.apiBaseUrl).toBe("https://custom-api.example.com");
    });
  });

  describe("edge case: default path uses account index", () => {
    it("generates index-based derivation paths when path not specified", async () => {
      await createAgentSession(mockParentClient, {
        ...baseRequest,
        accounts: [
          { label: "acc-0", curve: "CURVE_P256" },
          { label: "acc-1", curve: "CURVE_ED25519" },
        ],
      });

      const subOrgArgs =
        mockParentClient.createSubOrganization.mock.calls[0][0];
      expect(subOrgArgs.wallet.accounts[0].path).toBe("m/44'/1'/0'/0/0");
      expect(subOrgArgs.wallet.accounts[1].path).toBe("m/44'/1'/1'/0/0");
    });
  });

  describe("edge case: export skipped when walletId is undefined", () => {
    it("does not call exportWalletAccount when no wallet was created", async () => {
      mockParentClient.createSubOrganization.mockResolvedValue({
        subOrganizationId: "sub-org-123",
        rootUserIds: ["root-user-456"],
        activity: { id: "activity-1", status: "ACTIVITY_STATUS_COMPLETED" },
        // No wallet in response
      });

      const result = await createAgentSession(mockParentClient, {
        ...baseRequest,
        accounts: [gitSigning({ exportKey: true })],
      });

      expect(mockSubOrgApiClient.exportWalletAccount).not.toHaveBeenCalled();
      expect(result.accounts[0]!.exportBundle).toBeUndefined();
    });
  });

  describe("edge case: fewer wallet addresses than accounts", () => {
    it("sets empty publicKey for accounts without a matching address", async () => {
      mockParentClient.createSubOrganization.mockResolvedValue({
        subOrganizationId: "sub-org-123",
        rootUserIds: ["root-user-456"],
        wallet: {
          walletId: "wallet-789",
          addresses: ["0xaddr1"], // Only 1 address for 2 accounts
        },
        activity: { id: "activity-1", status: "ACTIVITY_STATUS_COMPLETED" },
      });

      const result = await createAgentSession(mockParentClient, {
        ...baseRequest,
        accounts: [jwtSigning(), gitSigning()],
      });

      expect(result.accounts).toHaveLength(2);
      expect(result.accounts[0]!.publicKey).toBe("0xaddr1");
      expect(result.accounts[1]!.publicKey).toBe("");
    });
  });

  describe("two-client pattern", () => {
    it("instantiates sub-org SDK with admin key, not agent key", async () => {
      await createAgentSession(mockParentClient, baseRequest);

      // TurnkeyServerSDK should be called with admin key pair
      expect(mockTurnkeyServerSDK).toHaveBeenCalledTimes(1);
      const sdkConfig = mockTurnkeyServerSDK.mock.calls[0][0];
      expect(sdkConfig.apiPublicKey).toBe(ADMIN_KEY_PAIR.publicKey);
      expect(sdkConfig.apiPrivateKey).toBe(ADMIN_KEY_PAIR.privateKey);
      expect(sdkConfig.defaultOrganizationId).toBe("sub-org-123");
    });

    it("uses sub-org client for createUsers, createApiKeys, and createPolicies, not parent client", async () => {
      await createAgentSession(mockParentClient, baseRequest);

      // Parent client should only be used for createSubOrganization
      expect(mockParentClient.createSubOrganization).toHaveBeenCalledTimes(1);
      // Sub-org client should be used for createUsers, createApiKeys, and createPolicies
      expect(mockSubOrgApiClient.createUsers).toHaveBeenCalledTimes(1);
      expect(mockSubOrgApiClient.createApiKeys).toHaveBeenCalledTimes(1);
      expect(mockSubOrgApiClient.createPolicies).toHaveBeenCalledTimes(1);
    });
  });

  describe("HPKE export", () => {
    it("calls exportWalletAccount with session key uncompressed public key", async () => {
      const result = await createAgentSession(mockParentClient, {
        ...baseRequest,
        accounts: [gitSigning({ exportKey: true })],
      });

      expect(mockSubOrgApiClient.exportWalletAccount).toHaveBeenCalledTimes(1);
      const exportArgs =
        mockSubOrgApiClient.exportWalletAccount.mock.calls[0][0];
      expect(exportArgs.targetPublicKey).toBe(
        AGENT_SESSION_KEY_PAIR.publicKeyUncompressed,
      );
      expect(exportArgs.address).toBe("0xaddr1");
      expect(exportArgs.organizationId).toBe("sub-org-123");

      expect(result.accounts[0]!.exportBundle).toBe(
        "encrypted-key-bundle-base64",
      );
    });

    it("handles export failure as non-fatal", async () => {
      mockSubOrgApiClient.exportWalletAccount.mockRejectedValue(
        new Error("export failed"),
      );

      const result = await createAgentSession(mockParentClient, {
        ...baseRequest,
        accounts: [gitSigning({ exportKey: true })],
      });

      // Account still in result, just no exportBundle
      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0]!.exportBundle).toBeUndefined();
      expect(result.accounts[0]!.label).toBe("git-signing");

      // No cleanup triggered (export failure is non-fatal)
      expect(mockParentClient.deleteSubOrganization).not.toHaveBeenCalled();
    });

    it("skips export when exportKey is false", async () => {
      await createAgentSession(mockParentClient, {
        ...baseRequest,
        accounts: [gitSigning()], // exportKey defaults to false
      });

      expect(mockSubOrgApiClient.exportWalletAccount).not.toHaveBeenCalled();
    });
  });

  describe("multi-curve accounts", () => {
    it("creates wallet with P256 + Ed25519 + secp256k1 accounts", async () => {
      await createAgentSession(mockParentClient, {
        ...baseRequest,
        accounts: [jwtSigning(), gitSigning(), ethSigning()],
      });

      const subOrgArgs =
        mockParentClient.createSubOrganization.mock.calls[0][0];
      const accounts = subOrgArgs.wallet.accounts;

      expect(accounts).toHaveLength(3);
      expect(accounts[0].curve).toBe("CURVE_P256");
      expect(accounts[0].addressFormat).toBe("ADDRESS_FORMAT_COMPRESSED");
      expect(accounts[1].curve).toBe("CURVE_ED25519");
      expect(accounts[1].addressFormat).toBe("ADDRESS_FORMAT_SOLANA");
      expect(accounts[2].curve).toBe("CURVE_SECP256K1");
      expect(accounts[2].addressFormat).toBe("ADDRESS_FORMAT_ETHEREUM");
    });

    it("maps all accounts to result with correct labels", async () => {
      mockParentClient.createSubOrganization.mockResolvedValue({
        subOrganizationId: "sub-org-123",
        rootUserIds: ["root-user-456"],
        wallet: {
          walletId: "wallet-789",
          addresses: ["p256-addr", "ed25519-addr", "secp-addr"],
        },
        activity: { id: "activity-1", status: "ACTIVITY_STATUS_COMPLETED" },
      });

      const result = await createAgentSession(mockParentClient, {
        ...baseRequest,
        accounts: [jwtSigning(), gitSigning(), ethSigning()],
      });

      expect(result.accounts).toHaveLength(3);
      expect(result.accounts[0]!.label).toBe("jwt-signing");
      expect(result.accounts[0]!.publicKey).toBe("p256-addr");
      expect(result.accounts[1]!.label).toBe("git-signing");
      expect(result.accounts[1]!.publicKey).toBe("ed25519-addr");
      expect(result.accounts[2]!.label).toBe("eth-signing");
      expect(result.accounts[2]!.publicKey).toBe("secp-addr");
    });
  });
});
