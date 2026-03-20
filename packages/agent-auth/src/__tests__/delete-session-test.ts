import { deleteAgentSession } from "../delete-session";

const mockParentClient = {
  deleteSubOrganization: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();

  mockParentClient.deleteSubOrganization.mockResolvedValue({
    activity: {
      id: "activity-del-1",
      status: "ACTIVITY_STATUS_COMPLETED",
    },
  });
});

describe("deleteAgentSession", () => {
  it("calls deleteSubOrganization with sub-org ID and deleteWithoutExport", async () => {
    const result = await deleteAgentSession(mockParentClient, {
      organizationId: "parent-org-id",
      subOrganizationId: "sub-org-to-delete",
    });

    expect(mockParentClient.deleteSubOrganization).toHaveBeenCalledTimes(1);
    const args = mockParentClient.deleteSubOrganization.mock.calls[0][0];
    expect(args.organizationId).toBe("sub-org-to-delete");
    expect(args.deleteWithoutExport).toBe(true);

    expect(result.subOrganizationId).toBe("sub-org-to-delete");
  });

  it("propagates errors from deleteSubOrganization", async () => {
    mockParentClient.deleteSubOrganization.mockRejectedValue(
      new Error("sub-org not found")
    );

    await expect(
      deleteAgentSession(mockParentClient, {
        organizationId: "parent-org-id",
        subOrganizationId: "nonexistent-sub-org",
      })
    ).rejects.toThrow("sub-org not found");
  });
});
