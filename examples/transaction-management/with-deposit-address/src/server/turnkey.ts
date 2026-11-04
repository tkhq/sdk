import { Turnkey } from "@turnkey/sdk-server";
import { serverEnv } from "@/server/env";

// An API client that signs as the delegated user inside one user's
// sub-organization. Whatever it asks for is checked against that sub-org's
// policies; it has no root rights anywhere.
export function delegatedClient(subOrgId: string) {
  return new Turnkey({
    apiBaseUrl: serverEnv.apiBaseUrl,
    apiPublicKey: serverEnv.daPublicKey,
    apiPrivateKey: serverEnv.daPrivateKey,
    defaultOrganizationId: subOrgId,
  }).apiClient();
}

export type DelegatedClient = ReturnType<typeof delegatedClient>;
