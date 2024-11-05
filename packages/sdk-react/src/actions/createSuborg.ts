import type { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";

type CreateSuborgRequest = {
  oauthProviders?: Provider[];
  email?: string;
  phoneNumber?: string;
  passkey?: Passkey;

};

type Passkey = {
    authenticatorName: string,
    challenge: any,
    attestation: any,
  };

type Provider = {
  providerName: string;
  oidcToken: string;
};

type CreateSuborgResponse = {
  subOrganizationId: string;
};

export async function createSuborg(
  request: CreateSuborgRequest,
  turnkeyClient: TurnkeySDKClient
): Promise<CreateSuborgResponse | undefined> {
  try {
    const suborgResponse = await turnkeyClient.apiClient().createSubOrganization({
      subOrganizationName: `suborg-${String(Date.now())}`,
      rootQuorumThreshold: 1,
      rootUsers: [
        {
          userName: request.email ?? "",
          userEmail: request.email ?? "",
          userPhoneNumber: request.phoneNumber ?? "",
          apiKeys: [],
          authenticators: request.passkey ? [request.passkey] : [],
          oauthProviders: request.oauthProviders ?? [],
        },
      ],
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
