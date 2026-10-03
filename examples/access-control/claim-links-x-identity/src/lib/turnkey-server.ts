import { Turnkey } from "@turnkey/sdk-server";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function parentOrganizationId(): string {
  return required("NEXT_PUBLIC_ORGANIZATION_ID");
}

export function backendPublicKey(): string {
  return required("API_PUBLIC_KEY");
}

export function turnkeyClient(organizationId = parentOrganizationId()) {
  return new Turnkey({
    apiBaseUrl: required("NEXT_PUBLIC_BASE_URL"),
    apiPublicKey: backendPublicKey(),
    apiPrivateKey: required("API_PRIVATE_KEY"),
    defaultOrganizationId: organizationId,
  }).apiClient();
}

// The fields of v1OrganizationData this example reads. @turnkey/sdk-server does not
// surface get_organization as a named method, so we post to the endpoint directly
// rather than taking a dependency on @turnkey/http just for its response type.
type AllocationData = {
  organizationId: string;
  name?: string;
  users?: { userId: string; oauthProviders: { subject: string }[] }[];
  rootQuorum?: { threshold: number; userIds: string[] };
  policies?: { policyName: string }[];
  // note: get_organization does not include wallet accounts; use getWalletAccounts
  wallets?: { walletId: string; walletName?: string }[];
};

export async function getAllocation(subOrgId: string): Promise<AllocationData> {
  const { organizationData } = await turnkeyClient(subOrgId).request<
    { organizationId: string },
    { organizationData: AllocationData }
  >("/public/v1/query/get_organization", { organizationId: subOrgId });
  if (!organizationData.name || organizationData.organizationId !== subOrgId) {
    throw new Error("allocation not found");
  }
  return organizationData;
}
