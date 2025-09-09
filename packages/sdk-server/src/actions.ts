"use server";

import {
  type CreateOauthProvidersRequest,
  type CreateOauthProvidersResponse,
  type OauthLoginRequest,
  type OauthLoginResponse,
  type OtpLoginRequest,
  type OtpLoginResponse,
  type CreateSuborgRequest,
  type CreateSuborgResponse,
  FilterType,
  type GetOrCreateSuborgRequest,
  type GetOrCreateSuborgResponse,
  type GetSuborgsRequest,
  type GetSuborgsResponse,
  type GetUsersRequest,
  type GetUsersResponse,
  type InitEmailAuthRequest,
  type SendOtpRequest,
  type SendOtpResponse,
  type VerifyOtpRequest,
  type VerifyOtpResponse,
} from "./__types__/base";
import { TurnkeyServerSDK } from "./sdk-client";
import {
  DEFAULT_ETHEREUM_ACCOUNTS,
  DEFAULT_SOLANA_ACCOUNTS,
} from "./turnkey-helpers";
import { WalletType } from "@turnkey/wallet-stamper";

const turnkeyClient = new TurnkeyServerSDK({
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
});

export async function sendCredential(
  request: InitEmailAuthRequest,
): Promise<void> {
  try {
    const response = await turnkeyClient.apiClient().emailAuth({
      email: request.email,
      targetPublicKey: request.targetPublicKey,
      organizationId: request.suborgID,
      ...(request.apiKeyName && { apiKeyName: request.apiKeyName }),
      ...(request.sessionLengthSeconds !== undefined && {
        expirationSeconds: request.sessionLengthSeconds.toString(),
      }),
      ...(request.invalidateExisting && {
        invalidateExisting: request.invalidateExisting,
      }),
      ...(request.emailCustomization && {
        emailCustomization: request.emailCustomization,
      }),
      ...(request.sendFromEmailAddress && {
        sendFromEmailAddress: request.sendFromEmailAddress,
      }),
    });
    if (!response.userId) {
      throw new Error("Expected a non-null userId.");
    }
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function sendOtp(
  request: SendOtpRequest,
): Promise<SendOtpResponse | undefined> {
  try {
    const response = await turnkeyClient.apiClient().initOtp({
      contact: request.contact,
      otpType: request.otpType,
      ...(request.emailCustomization && {
        emailCustomization: request.emailCustomization,
      }),
      ...(request.sendFromEmailAddress && {
        sendFromEmailAddress: request.sendFromEmailAddress,
      }),
      ...(request.sendFromEmailSenderName && {
        sendFromEmailSenderName: request.sendFromEmailSenderName,
      }),
      ...(request.userIdentifier && { userIdentifier: request.userIdentifier }),
      ...(request.customSmsMessage && {
        smsCustomization: { template: request.customSmsMessage },
      }),
      ...(request.otpLength && {
        otpLength: request.otpLength,
      }),
      alphanumeric: request.alphanumeric ?? true,
    });
    if (!response.otpId) {
      throw new Error("Expected a non-null otpId.");
    }
    return response;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function verifyOtp(
  request: VerifyOtpRequest,
): Promise<VerifyOtpResponse | undefined> {
  try {
    const response = await turnkeyClient.apiClient().verifyOtp({
      otpId: request.otpId,
      otpCode: request.otpCode,
      ...(request.sessionLengthSeconds !== undefined && {
        expirationSeconds: request.sessionLengthSeconds.toString(),
      }),
    });

    const { verificationToken } = response;
    if (!verificationToken) {
      throw new Error("Expected a non-null value for verificationToken");
    }
    return response;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function otpLogin(
  request: OtpLoginRequest,
): Promise<OtpLoginResponse | undefined> {
  try {
    const response = await turnkeyClient.apiClient().otpLogin({
      organizationId: request.suborgID,
      verificationToken: request.verificationToken,
      publicKey: request.publicKey,
      ...(request.sessionLengthSeconds !== undefined && {
        expirationSeconds: request.sessionLengthSeconds.toString(),
      }),
    });
    const { session } = response;
    if (!session) {
      throw new Error("Expected a non-null value for session");
    }
    return response;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function oauthLogin(
  request: OauthLoginRequest,
): Promise<OauthLoginResponse | undefined> {
  try {
    const response = await turnkeyClient.apiClient().oauthLogin({
      organizationId: request.suborgID,
      oidcToken: request.oidcToken,
      publicKey: request.publicKey,
      ...(request.sessionLengthSeconds !== undefined && {
        expirationSeconds: request.sessionLengthSeconds.toString(),
      }),
    });

    const { session } = response;
    if (!session) {
      throw new Error("Expected a non-null value for session");
    }
    return response;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function createOauthProviders(
  request: CreateOauthProvidersRequest,
): Promise<CreateOauthProvidersResponse | undefined> {
  // Create Oauth Providers can be called by the parent targeting the suborg only when the following cases are true:
  // 1. the oAuth issuer is Google,
  // 2. the oAuth issuer has verified the email in the token
  // 3. the email in the token matches the email that the user has already has logged in with
  try {
    const response = await turnkeyClient.apiClient().createOauthProviders({
      organizationId: request.organizationId,
      userId: request.userId,
      oauthProviders: request.oauthProviders,
    });

    if (!response) {
      throw new Error("Expected a non-null response.");
    }
    return response;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function getUsers(
  request: GetUsersRequest,
): Promise<GetUsersResponse | undefined> {
  try {
    const response = await turnkeyClient.apiClient().getUsers({
      organizationId: request.organizationId,
    });

    if (!response || !response.users) {
      throw new Error("Expected a non-null response with userIds.");
    }
    return { users: response.users };
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function getSuborgs(
  request: GetSuborgsRequest,
): Promise<GetSuborgsResponse> {
  const response = await turnkeyClient.apiClient().getSubOrgIds({
    organizationId: turnkeyClient.config.defaultOrganizationId,
    filterType: request.filterType,
    filterValue: request.filterValue,
  });

  if (!response || !response?.organizationIds) {
    throw new Error("Expected a non-null response.");
  }

  return { organizationIds: response.organizationIds };
}

export async function getVerifiedSuborgs(
  request: GetSuborgsRequest,
): Promise<GetSuborgsResponse> {
  const response = await turnkeyClient.apiClient().getVerifiedSubOrgIds({
    organizationId: turnkeyClient.config.defaultOrganizationId,
    filterType: request.filterType,
    filterValue: request.filterValue,
  });

  if (!response || !response?.organizationIds) {
    throw new Error("Expected a non-null response.");
  }

  return { organizationIds: response.organizationIds };
}

export async function createSuborg(
  request: CreateSuborgRequest,
): Promise<CreateSuborgResponse | undefined> {
  try {
    const response = await turnkeyClient.apiClient().createSubOrganization({
      subOrganizationName: `suborg-${String(Date.now())}`,
      rootQuorumThreshold: 1,
      rootUsers: [
        {
          userName: request.email ?? "",
          userEmail: request.email ?? "",
          ...(request.phoneNumber
            ? { userPhoneNumber: request.phoneNumber }
            : {}),
          apiKeys: request.wallet
            ? [
                {
                  apiKeyName: `wallet-auth:${request.wallet.publicKey}`,
                  publicKey: request.wallet.publicKey,
                  curveType:
                    request.wallet.type === WalletType.Ethereum
                      ? ("API_KEY_CURVE_SECP256K1" as const)
                      : ("API_KEY_CURVE_ED25519" as const),
                },
              ]
            : [],
          authenticators: request.passkey ? [request.passkey] : [],
          oauthProviders: request.oauthProviders ?? [],
        },
      ],
      wallet: {
        walletName: `Wallet 1`,
        accounts: request.customAccounts ?? [
          ...DEFAULT_ETHEREUM_ACCOUNTS,
          ...DEFAULT_SOLANA_ACCOUNTS,
        ],
      },
    });

    if (!response.subOrganizationId) {
      throw new Error("Expected a non-null subOrganizationId.");
    }
    return { subOrganizationId: response.subOrganizationId };
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function getOrCreateSuborg(
  request: GetOrCreateSuborgRequest,
): Promise<GetOrCreateSuborgResponse> {
  // First try to get existing suborgs
  let suborgResponse: GetSuborgsResponse;

  const includeUnverified = request.includeUnverified === true;
  const isEmailOrPhone =
    request.filterType === FilterType.Email ||
    request.filterType === FilterType.PhoneNumber;

  if (!includeUnverified && isEmailOrPhone) {
    suborgResponse = await getVerifiedSuborgs({
      filterType: request.filterType,
      filterValue: request.filterValue,
    });
  } else {
    suborgResponse = await getSuborgs({
      filterType: request.filterType,
      filterValue: request.filterValue,
    });
  }

  // If we found atleast one subOrg, we return
  if (suborgResponse.organizationIds.length > 0) {
    return {
      subOrganizationIds: suborgResponse.organizationIds,
    };
  }

  // No existing suborg found - create a new one
  const createPayload: CreateSuborgRequest = {
    ...(request.additionalData?.email && {
      email: request.additionalData.email,
    }),
    ...(request.additionalData?.phoneNumber && {
      phoneNumber: request.additionalData.phoneNumber,
    }),
    ...(request.additionalData?.passkey && {
      passkey: request.additionalData.passkey,
    }),
    ...(request.additionalData?.oauthProviders && {
      oauthProviders: request.additionalData.oauthProviders,
    }),
    ...(request.additionalData?.customAccounts && {
      customAccounts: request.additionalData.customAccounts,
    }),
    ...(request.additionalData?.wallet && {
      wallet: request.additionalData.wallet,
    }),
  };

  const creationResponse = await createSuborg(createPayload);

  if (!creationResponse?.subOrganizationId) {
    throw new Error("Suborg creation failed");
  }

  return {
    subOrganizationIds: [creationResponse.subOrganizationId],
  };
}
