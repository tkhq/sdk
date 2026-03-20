import { deleteAgentSession } from "../delete-session";

// Mock @turnkey/sdk-server
const mockAdminClient = {
  deleteSubOrganization: jest.fn(),
};

const mockTurnkeyServerSDK = jest.fn().mockImplementation(function (this: any, config: any) {
  this.config = config;
  this.apiClient = () => mockAdminClient;
});

jest.mock("@turnkey/sdk-server", () => ({
  TurnkeyServerSDK: mockTurnkeyServerSDK,
  Turnkey: mockTurnkeyServerSDK,
}));

beforeEach(() => {
  jest.clearAllMocks();

  mockAdminClient.deleteSubOrganization.mockResolvedValue({
    activity: {
      id: "activity-del-1",
      status: "ACTIVITY_STATUS_COMPLETED",
    },
  });
});

describe("deleteAgentSession", () => {
  it("creates admin client and calls deleteSubOrganization", async () => {
    const result = await deleteAgentSession({
      organizationId: "parent-org-id",
      subOrganizationId: "sub-org-to-delete",
      adminApiKey: {
        publicKey: "admin-pub",
        privateKey: "admin-priv",
      },
    });

    // Verify admin SDK instantiated with admin key
    expect(mockTurnkeyServerSDK).toHaveBeenCalledTimes(1);
    const sdkConfig = mockTurnkeyServerSDK.mock.calls[0][0];
    expect(sdkConfig.apiPublicKey).toBe("admin-pub");
    expect(sdkConfig.apiPrivateKey).toBe("admin-priv");
    expect(sdkConfig.defaultOrganizationId).toBe("sub-org-to-delete");

    // Verify delete called correctly
    expect(mockAdminClient.deleteSubOrganization).toHaveBeenCalledTimes(1);
    const args = mockAdminClient.deleteSubOrganization.mock.calls[0][0];
    expect(args.organizationId).toBe("sub-org-to-delete");
    expect(args.deleteWithoutExport).toBe(true);

    expect(result.subOrganizationId).toBe("sub-org-to-delete");
  });

  it("propagates errors from deleteSubOrganization", async () => {
    mockAdminClient.deleteSubOrganization.mockRejectedValue(
      new Error("sub-org not found")
    );

    await expect(
      deleteAgentSession({
        organizationId: "parent-org-id",
        subOrganizationId: "nonexistent-sub-org",
        adminApiKey: { publicKey: "pub", privateKey: "priv" },
      })
    ).rejects.toThrow("sub-org not found");
  });
});
