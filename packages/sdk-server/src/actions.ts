"use server";

import {
  CreateOauthSessionRequest,
  CreateOauthSessionResponse,
  CreateOtpSessionRequest,
  CreateOtpSessionResponse,
  CreateSuborgRequest,
  CreateSuborgResponse,
  FilterType,
  GetOrCreateSuborgRequest,
  GetOrCreateSuborgResponse,
  GetSuborgsRequest,
  GetSuborgsResponse,
  InitEmailAuthRequest,
  SendOtpRequest,
  SendOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
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
      throw new Error(
        "Expected a non-null value for verificationToken",
      );
    }
    return response;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function createOtpSession(  request: CreateOtpSessionRequest): Promise<CreateOtpSessionResponse | undefined> {
  try {
    console.log("createOtpSession", request);
    const response = await turnkeyClient.apiClient().otpLogin({organizationId: request.suborgID, verificationToken: request.verificationToken, publicKey: request.publicKey, ...(request.sessionLengthSeconds !== undefined && { expirationSeconds: request.sessionLengthSeconds.toString(), }),});
    console.log(response)
    const { session } = response;
    if (!session) {
      throw new Error(
        "Expected a non-null value for session",
      );
    }
    return response;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function createOauthSession( request: CreateOauthSessionRequest): Promise<CreateOauthSessionResponse | undefined> {
  try {
    const response = await turnkeyClient.apiClient().oauthLogin({organizationId: request.suborgID, oidcToken: request.oidcToken, publicKey: request.publicKey, ...(request.sessionLengthSeconds !== undefined && { expirationSeconds: request.sessionLengthSeconds.toString(), }),});

    const { session } = response;
    if (!session) {
      throw new Error(
        "Expected a non-null value for session",
      );
    }
    return response;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function getSuborgs(
  request: GetSuborgsRequest,
): Promise<GetSuborgsResponse | undefined> {
  try {
    const response = await turnkeyClient.apiClient().getSubOrgIds({
      organizationId: turnkeyClient.config.defaultOrganizationId,
      filterType: request.filterType,
      filterValue: request.filterValue,
    });

    if (!response || !response.organizationIds) {
      throw new Error("Expected a non-null response with organizationIds.");
    }
    return { organizationIds: response.organizationIds };
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function getVerifiedSuborgs(
  request: GetSuborgsRequest,
): Promise<GetSuborgsResponse | undefined> {
  try {
    const response = await turnkeyClient.apiClient().getVerifiedSubOrgIds({
      organizationId: turnkeyClient.config.defaultOrganizationId,
      filterType: request.filterType,
      filterValue: request.filterValue,
    });

    if (!response || !response.organizationIds) {
      throw new Error("Expected a non-null response with organizationIds.");
    }
    return { organizationIds: response.organizationIds };
  } catch (error) {
    console.error(error);
    return undefined;
  }
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
): Promise<GetOrCreateSuborgResponse | undefined> {
  try {
    // First try to get existing suborgs
    let suborgResponse: GetSuborgsResponse | undefined;

    if (
      request.filterType === FilterType.Email ||
      request.filterType === FilterType.PhoneNumber
    ) {
      suborgResponse = await getVerifiedSuborgs({
        filterType: request.filterType,
        filterValue: request.filterValue,
      });
    } else {
      suborgResponse = await getSuborgs({
        // For OIDC
        filterType: request.filterType,
        filterValue: request.filterValue,
      });
    }

    // If we found existing suborgs, return the first one
    if (
      suborgResponse &&
      suborgResponse?.organizationIds &&
      suborgResponse?.organizationIds?.length > 0
    ) {
      return {
        subOrganizationIds: suborgResponse.organizationIds!,
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
  } catch (error) {
    console.error("Error in getOrCreateSuborg:", error);
    return undefined;
  }
}
