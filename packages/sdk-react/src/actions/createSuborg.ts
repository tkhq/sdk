"use server";

import { DEFAULT_ETHEREUM_ACCOUNTS, DEFAULT_SOLANA_ACCOUNTS } from "@turnkey/sdk-browser";
import { Turnkey } from "@turnkey/sdk-server";

type CreateSuborgRequest = {
  oauthProviders?: Provider[];
  email?: string;
  phoneNumber?: string;
  passkey?: Passkey;
};

type Passkey = {
  authenticatorName: string;
  challenge: any;
  attestation: any;
};

type Provider = {
  providerName: string;
  oidcToken: string;
};

type CreateSuborgResponse = {
  subOrganizationId: string;
};

export async function createSuborg(
  request: CreateSuborgRequest
): Promise<CreateSuborgResponse | undefined> {
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!, // DO NOT EXPOSE THESE TO YOUR CLIENT SIDE CODE
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!, // DO NOT EXPOSE THESE TO YOUR CLIENT SIDE CODE
  });
  try {
    const suborgResponse = await turnkeyClient
      .apiClient()
      .createSubOrganization({
        subOrganizationName: `suborg-${String(Date.now())}`,
        rootQuorumThreshold: 1,
        rootUsers: [
          {
            userName: request.email ?? "",
            userEmail: request.email ?? "",
            ...(request.phoneNumber ? { userPhoneNumber: request.phoneNumber } : {}),
            apiKeys: [],
            authenticators: request.passkey ? [request.passkey] : [],
            oauthProviders: request.oauthProviders ?? [],
          },
        ],
        wallet: {
          walletName:`wallet-${String(Date.now())}` ,
          accounts: [
            ...DEFAULT_ETHEREUM_ACCOUNTS,
            ...DEFAULT_SOLANA_ACCOUNTS,
          ],
        },

      });

    const { subOrganizationId } = suborgResponse;
    if (!subOrganizationId) {
      throw new Error("Expected a non-null subOrganizationId.");
    }

    return { subOrganizationId };
  } catch (error) {
    console.error(error);
    return undefined;
  }
}
