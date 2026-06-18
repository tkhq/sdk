import "server-only";
import { Turnkey } from "@turnkey/sdk-server";
import { env } from "@/env";

export function getParentClient() {
  return new Turnkey({
    apiBaseUrl: env.TURNKEY_BASE_URL,
    apiPublicKey: env.API_PUBLIC_KEY,
    apiPrivateKey: env.API_PRIVATE_KEY,
    defaultOrganizationId: env.NEXT_PUBLIC_TURNKEY_ORG_ID,
  });
}

export function getSubOrgClient(args: {
  subOrgId: string;
  apiPublicKey: string;
  apiPrivateKey: string;
}) {
  return new Turnkey({
    apiBaseUrl: env.TURNKEY_BASE_URL,
    apiPublicKey: args.apiPublicKey,
    apiPrivateKey: args.apiPrivateKey,
    defaultOrganizationId: args.subOrgId,
  });
}
