import type {
  DeleteAgentSessionRequest,
  DeleteAgentSessionResult,
} from "./types";

/**
 * Delete an agent session and all associated resources.
 *
 * Uses the sub-org admin key (from CreateAgentSessionResult.adminApiKey) to
 * authenticate as the sub-org root user and delete the sub-org.
 * This destroys all users, wallets, keys, and policies within it.
 *
 * @param request - Identifies which agent session to delete, including admin credentials
 * @param options - Optional configuration (e.g., apiBaseUrl override)
 */
export async function deleteAgentSession(
  request: DeleteAgentSessionRequest,
  options?: { apiBaseUrl?: string },
): Promise<DeleteAgentSessionResult> {
  const sdkServer = await import("@turnkey/sdk-server");
  const TurnkeyServerSDK =
    (sdkServer as any).TurnkeyServerSDK ?? (sdkServer as any).Turnkey;

  const apiBaseUrl = options?.apiBaseUrl ?? "https://api.turnkey.com";

  const adminSdk = new TurnkeyServerSDK({
    apiBaseUrl,
    apiPublicKey: request.adminApiKey.publicKey,
    apiPrivateKey: request.adminApiKey.privateKey,
    defaultOrganizationId: request.subOrganizationId,
  });

  const adminClient = adminSdk.apiClient();

  await adminClient.deleteSubOrganization({
    organizationId: request.subOrganizationId,
    deleteWithoutExport: true,
  });

  return {
    subOrganizationId: request.subOrganizationId,
  };
}
