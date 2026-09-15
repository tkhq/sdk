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

export async function getAllocation(subOrgId: string) {
  const { organizationData } = await turnkeyClient(subOrgId).getOrganization({
    organizationId: subOrgId,
  });
  if (!organizationData.name || organizationData.organizationId !== subOrgId) {
    throw new Error("allocation not found");
  }
  return organizationData;
}
