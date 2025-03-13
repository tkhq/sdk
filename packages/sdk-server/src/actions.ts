"use server";

import { TurnkeyServerSDK } from "./sdk-client";
import {
  DEFAULT_ETHEREUM_ACCOUNTS,
  DEFAULT_SOLANA_ACCOUNTS,
  WalletAccount,
} from "./turnkey-helpers";
import { WalletType } from "@turnkey/wallet-stamper";

type GetOrCreateSuborgRequest = {
  filterType: FilterType;
  filterValue: string;
  additionalData?: {
    email?: string;
    phoneNumber?: string;
    passkey?: Passkey;
    oauthProviders?: Provider[];
    customAccounts?: WalletAccount[];
    wallet?: {
      publicKey: string;
      type: WalletType;
    };
  };
};

enum FilterType {
  Email = "EMAIL",
  PhoneNumber = "PHONE_NUMBER",
  OidcToken = "OIDC_TOKEN",
  PublicKey = "PUBLIC_KEY",
}

enum SessionType {
  READ_ONLY = "SESSION_TYPE_READ_ONLY",
  READ_WRITE = "SESSION_TYPE_READ_WRITE",
}

type Session = {
  sessionType: SessionType;
  userId: string;
  organizationId: string;
  expiry: number;
  token: string;
};

type VerifyOtpRequest = {
  suborgID: string;
  otpId: string;
  otpCode: string;
  targetPublicKey: string;
  sessionLengthSeconds?: number | undefined;
};

type OauthRequest = {
  suborgID: string;
  oidcToken: string;
  targetPublicKey: string;
  sessionLengthSeconds?: number | undefined;
};

type SendOtpRequest = {
  suborgID: string;
  otpType: string;
  contact: string;
  customSmsMessage?: string | undefined;
  userIdentifier?: string | undefined;
};

type SendOtpResponse = {
  otpId: string;
};

type InitEmailAuthRequest = {
  suborgID: string;
  email: string;
  targetPublicKey: string;
  apiKeyName?: string | undefined;
  userIdentifier?: string | undefined;
  sessionLengthSeconds?: number | undefined;
  invalidateExisting?: boolean | undefined;
};

type GetSuborgsRequest = {
  filterValue: string;
  filterType: string;
};

type GetSuborgsResponse = {
  organizationIds: string[];
};

type CreateSuborgRequest = {
  oauthProviders?: Provider[] | undefined;
  email?: string | undefined;
  phoneNumber?: string | undefined;
  passkey?: Passkey | undefined;
  customAccounts?: WalletAccount[] | undefined;
  wallet?: {
    publicKey: string;
    type: WalletType;
  };
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

type GetOrCreateSuborgResponse = {
  subOrganizationIds: string[];
};

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
    const response = await turnkeyClient.apiClient().initOtpAuth({
      contact: request.contact,
      otpType: request.otpType,
      organizationId: request.suborgID,
      ...(request.userIdentifier && { userIdentifier: request.userIdentifier }),
      ...(request.customSmsMessage && {
        smsCustomization: { template: request.customSmsMessage },
      }),
    });
    if (!response.otpId) {
      throw new Error("Expected a non-null otpId.");
    }
    return { otpId: response.otpId };
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function verifyOtp(
  request: VerifyOtpRequest,
): Promise<Session | undefined> {
  try {
    const response = await turnkeyClient.apiClient().otpAuth({
      otpId: request.otpId,
      otpCode: request.otpCode,
      targetPublicKey: request.targetPublicKey,
      organizationId: request.suborgID,
      ...(request.sessionLengthSeconds !== undefined && {
        expirationSeconds: request.sessionLengthSeconds.toString(),
      }),
    });

    const { credentialBundle, apiKeyId, userId } = response;
    if (!credentialBundle || !apiKeyId || !userId) {
      throw new Error(
        "Expected non-null values for credentialBundle, apiKeyId, and userId.",
      );
    }
    const session: Session = {
      sessionType: SessionType.READ_WRITE,
      userId: userId,
      organizationId: request.suborgID,
      expiry: Date.now() + Number(900) * 1000, // TODO: change this to the actual expiry time from the response,
      token: credentialBundle,
    };
    return session;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function oauth(
  request: OauthRequest,
): Promise<Session | undefined> {
  try {
    const response = await turnkeyClient.apiClient().oauth({
      oidcToken: request.oidcToken,
      targetPublicKey: request.targetPublicKey,
      organizationId: request.suborgID,
      ...(request.sessionLengthSeconds !== undefined && {
        expirationSeconds: request.sessionLengthSeconds.toString(),
      }),
    });

    const { credentialBundle, apiKeyId, userId } = response;
    if (!credentialBundle || !apiKeyId || !userId) {
      throw new Error(
        "Expected non-null values for credentialBundle, apiKeyId, and userId.",
      );
    }
    const session: Session = {
      sessionType: SessionType.READ_WRITE,
      userId: userId,
      organizationId: request.suborgID,
      expiry:
        Math.floor(Date.now() / 1000) + (request.sessionLengthSeconds ?? 900), //TODO change this to the actual expiry time from the response,
      token: credentialBundle,
    };
    return session;
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
