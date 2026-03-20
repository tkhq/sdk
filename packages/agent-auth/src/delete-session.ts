import type { DeleteAgentSessionRequest, DeleteAgentSessionResult } from "./types";

/**
 * Delete an agent session and all associated resources.
 *
 * Calls DeleteSubOrganization with deleteWithoutExport: true.
 * This destroys the sub-org, all users, wallets, keys, and policies within it.
 *
 * @param parentClient - TurnkeyApiClient authenticated as the parent org
 * @param request - Identifies which agent session to delete
 */
export async function deleteAgentSession(
  parentClient: { deleteSubOrganization: Function; [key: string]: any },
  request: DeleteAgentSessionRequest
): Promise<DeleteAgentSessionResult> {
  // To delete a sub-org, the organizationId in the request should be the sub-org itself
  await parentClient.deleteSubOrganization({
    organizationId: request.subOrganizationId,
    deleteWithoutExport: true,
  });

  return {
    subOrganizationId: request.subOrganizationId,
  };
}
