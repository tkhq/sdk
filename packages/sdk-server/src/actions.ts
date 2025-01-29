"use server";

import { TurnkeyServerSDK } from "./sdk-client";
import {
  DEFAULT_ETHEREUM_ACCOUNTS,
  DEFAULT_SOLANA_ACCOUNTS,
  WalletAccount,
} from "./turnkey-helpers";

type Session = {
  sessionType: string;
  userId: string;
  organizationId: string;
  expiry: number;
  token: string | undefined;
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
      sessionType: "rw",
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
      sessionType: "rw",
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
          apiKeys: [],
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
