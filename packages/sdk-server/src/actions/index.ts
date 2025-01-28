"use server";

import { Turnkey } from "..";
import { DEFAULT_ETHEREUM_ACCOUNTS, DEFAULT_SOLANA_ACCOUNTS, WalletAccount } from "../turnkey-helpers";

type OtpAuthRequest = {
  suborgID: string;
  otpId: string;
  otpCode: string;
  targetPublicKey: string;
  sessionLengthSeconds?: number;
};

type OtpAuthResponse = {
  userId: string;
  apiKeyId: string;
  credentialBundle: string;
};

type OauthRequest = {
  suborgID: string;
  oidcToken: string;
  targetPublicKey: string;
  sessionLengthSeconds?: number;
};

type OauthResponse = {
  userId: string;
  apiKeyId: string;
  credentialBundle: string;
};

type InitOtpAuthRequest = {
  suborgID: string;
  otpType: string;
  contact: string;
  customSmsMessage?: string;
  userIdentifier?: string;
};

type InitOtpAuthResponse = {
  otpId: string;
};

type GetSuborgsRequest = {
  filterValue: string;
  filterType: string;
};

type GetSuborgsResponse = {
  organizationIds: string[];
};

type CreateSuborgRequest = {
  oauthProviders?: Provider[];
  email?: string;
  phoneNumber?: string;
  passkey?: Passkey;
  customAccounts?: WalletAccount[];
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

export class Server {
  private turnkeyClient: Turnkey;

  constructor() {
    this.turnkeyClient = new Turnkey({
      apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!, // DO NOT EXPOSE THESE TO YOUR CLIENT SIDE CODE
      apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!, // DO NOT EXPOSE THESE TO YOUR CLIENT SIDE CODE
    });
  }

  async initOtpAuth(request: InitOtpAuthRequest): Promise<InitOtpAuthResponse | undefined> {
    try {
      const response = await this.turnkeyClient.apiClient().initOtpAuth({
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

  async otpAuth(request: OtpAuthRequest): Promise<OtpAuthResponse | undefined> {
    try {
      const response = await this.turnkeyClient.apiClient().otpAuth({
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
        throw new Error("Expected non-null values for credentialBundle, apiKeyId, and userId.");
      }
      return { credentialBundle, apiKeyId, userId };
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  async oauth(request: OauthRequest): Promise<OauthResponse | undefined> {
    try {
      const response = await this.turnkeyClient.apiClient().oauth({
        oidcToken: request.oidcToken,
        targetPublicKey: request.targetPublicKey,
        organizationId: request.suborgID,
        ...(request.sessionLengthSeconds !== undefined && {
          expirationSeconds: request.sessionLengthSeconds.toString(),
        }),
      });

      const { credentialBundle, apiKeyId, userId } = response;
      if (!credentialBundle || !apiKeyId || !userId) {
        throw new Error("Expected non-null values for credentialBundle, apiKeyId, and userId.");
      }
      return { credentialBundle, apiKeyId, userId };
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  async getSuborgs(request: GetSuborgsRequest): Promise<GetSuborgsResponse | undefined> {
    try {
      const response = await this.turnkeyClient.apiClient().getSubOrgIds({
        organizationId: this.turnkeyClient.config.defaultOrganizationId,
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

  async createSuborg(request: CreateSuborgRequest): Promise<CreateSuborgResponse | undefined> {
    try {
      const response = await this.turnkeyClient.apiClient().createSubOrganization({
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
}

export const server = new Server();
