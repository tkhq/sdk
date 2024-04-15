import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { getWebAuthnAttestation } from "@turnkey/http";

import { VERSION } from "./__generated__/version";

import type {
  GrpcStatus,
  TurnkeySDKClientConfig,
  TurnkeySDKBrowserConfig,
} from "./__types__/base";

import { TurnkeyRequestError } from "./__types__/base";

import { TurnkeySDKClientBase } from "./__generated__/sdk-client-base";
import type * as SdkApiTypes from "./__generated__/sdk_api_types";

import elliptic from "elliptic";

import type { User, SubOrganization, SigningSession } from "./models";
import {
  StorageKeys,
  getStorageValue,
  removeStorageValue,
  setStorageValue,
} from "./storage";
import { generateRandomBuffer, base64UrlEncode } from "./utils";
import { DEFAULT_ETHEREUM_WALLET_ACCOUNT, DEFAULT_SOLANA_WALLET_ACCOUNT } from "./constants";

export class TurnkeyBrowserSDK {
  config: TurnkeySDKBrowserConfig;

  constructor(config: TurnkeySDKBrowserConfig) {
    this.config = config;
  }

  passkeySigner = async (
    rpId?: string
  ): Promise<TurnkeySDKBrowserClient> => {
    const targetRpId = rpId ?? (this.config.rpId ?? window.location.hostname);

    if (!targetRpId) {
      throw new Error('Tried to initialize a passkey signer with no rpId defined');
    }

    const webauthnStamper = new WebauthnStamper({
      rpId: targetRpId,
    });

    return new TurnkeySDKBrowserClient({
      stamper: webauthnStamper,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.defaultOrganizationId,
    });
  }

  iframeSigner = async (
    iframeContainer: HTMLElement | null | undefined,
    iframeUrl?: string
  ): Promise<TurnkeySDKBrowserClient> => {
    const targetIframeUrl = iframeUrl ?? this.config.iframeUrl;

    if (!targetIframeUrl) {
      throw new Error('Tried to initialize iframeSigner with no iframeUrl defined');
    }

    const TurnkeyIframeElementId = "turnkey-auth-iframe-element-id";

    const iframeStamper = new IframeStamper({
      iframeUrl: targetIframeUrl,
      iframeElementId: TurnkeyIframeElementId,
      iframeContainer: iframeContainer,
    });

    await iframeStamper.init();

    return new TurnkeySDKBrowserClient({
      stamper: iframeStamper,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.defaultOrganizationId,
    });
  };

  sessionSigner = async (): Promise<TurnkeySDKBrowserClient> => {
    const signingSession: SigningSession | undefined = await getStorageValue(StorageKeys.CurrentSigningSession);
    const sessionStamper = new ApiKeyStamper({
      apiPublicKey: signingSession!.publicKey,
      apiPrivateKey: signingSession!.privateKey,
    });

    return new TurnkeySDKBrowserClient({
      stamper: sessionStamper,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.defaultOrganizationId,
    });
  };

  serverSign = async <TResponseType>(
    methodName: string,
    params: any[],
    serverSignUrl?: string
  ): Promise<TResponseType> => {

    const targetServerSignUrl = serverSignUrl ?? this.config.serverSignUrl;


    if (!targetServerSignUrl) {
      throw new Error("Tried to call serverSign with no serverSignUrl defined");
    }

    const stringifiedBody = JSON.stringify({
      methodName: methodName,
      params: params,
    });

    const response = await fetch(targetServerSignUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Version": VERSION,
      },
      body: stringifiedBody,
      redirect: "follow",
    });

    if (!response.ok) {
      let res: GrpcStatus;
      try {
        res = await response.json();
      } catch (_) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      throw new TurnkeyRequestError(res);
    }

    const data = await response.json();
    return data as TResponseType;
  }

  // Local
  createUserPasskey = async (config: Record<any, any> = {}) => {
    const challenge = generateRandomBuffer();
    const encodedChallenge = base64UrlEncode(challenge);
    const authenticatorUserId = generateRandomBuffer();

    const webauthnConfig: CredentialCreationOptions = {
      publicKey: {
        rp: {
          id: config.publicKey?.rp?.id ?? "",
          name: config.publicKey?.rp?.name ?? "",
        },
        challenge: config.publicKey?.challenge ?? challenge,
        pubKeyCredParams: config.publicKey?.pubKeyCredParams ?? [
          {
            type: "public-key",
            alg: -7,
          },
        ],
        user: {
          id: config.publicKey?.user?.id ?? authenticatorUserId,
          name: config.publicKey?.user?.name ?? "",
          displayName: config.publicKey?.user?.displayName ?? "",
        },
        authenticatorSelection: {
          requireResidentKey:
            config.publicKey?.authenticatorSelection?.requireResidentKey ??
            true,
          residentKey:
            config.publicKey?.authenticatorSelection?.residentKey ?? "required",
          userVerification:
            config.publicKey?.authenticatorSelection?.userVerification ??
            "preferred",
        },
      },
    };

    const attestation = await getWebAuthnAttestation(webauthnConfig);

    return {
      encodedChallenge: config.publicKey?.challenge
        ? base64UrlEncode(config.publicKey?.challenge)
        : encodedChallenge,
      attestation: attestation,
    };
  };

  getCurrentSubOrganization = async (): Promise<
    SubOrganization | undefined
  > => {
    return await getStorageValue(StorageKeys.CurrentSubOrganization);
  };

  getCurrentUser = async (): Promise<User | undefined> => {
    return await getStorageValue(StorageKeys.CurrentUser);
  };

  getCurrentSigningSession = async (): Promise<SigningSession | undefined> => {
    return await getStorageValue(StorageKeys.CurrentSigningSession);
  };

  isSigningSessionActive = async (): Promise<boolean> => {
    const signingSession: SigningSession | undefined =
      await this.getCurrentSigningSession();

    if (signingSession && signingSession.expiration > Date.now()) {
      return true;
    }

    return false;
  };

  logoutUser = async (): Promise<boolean> => {
    await removeStorageValue(StorageKeys.CurrentUser);
    await removeStorageValue(StorageKeys.CurrentSubOrganization);

    return true;
  }

}

export class TurnkeySDKBrowserClient extends TurnkeySDKClientBase {

  constructor(config: TurnkeySDKClientConfig) {
    super(config);
  }

  createWalletWithAccount = async (params: {
    walletName: string;
    accountChain: string;
  }): Promise<SdkApiTypes.TCreateWalletAccountsResponse> => {
    switch (params.accountChain) {
      case "solana": {
        return await this.createWallet({
          walletName: params.walletName,
          accounts: [DEFAULT_SOLANA_WALLET_ACCOUNT],
        });
      }
      default: {
        return await this.createWallet({
          walletName: params.walletName,
          accounts: [DEFAULT_ETHEREUM_WALLET_ACCOUNT],
        });
      }
    }
  };

  createNextWalletAccount = async (params: {
    walletId: string;
  }): Promise<SdkApiTypes.TCreateWalletAccountsResponse> => {
    const walletAccounts = await this.getWalletAccounts({
      walletId: params.walletId,
    });
    const lastAccount =
      walletAccounts.accounts[walletAccounts.accounts.length - 1]!;
    const lastAccountPath = lastAccount.path.split("/");
    const lastAccountPathIndex = lastAccountPath[3]!.replace(/[^0-9]/g, "");
    const nextPathIndex = Number(lastAccountPathIndex) + 1;
    lastAccountPath[3] = `${nextPathIndex}'`;
    const nextAccountPath = lastAccountPath.join("/");

    return await this.createWalletAccounts({
      walletId: params.walletId,
      accounts: [
        {
          curve: lastAccount.curve,
          pathFormat: lastAccount.pathFormat,
          addressFormat: lastAccount.addressFormat,
          path: nextAccountPath,
        },
      ],
    });
  };

  login = async (): Promise<SdkApiTypes.TGetWhoamiResponse> => {
    const whoamiResult = await this.getWhoami();
    const currentUser: User = {
      userId: whoamiResult.userId,
      username: whoamiResult.username,
    };
    const currentSubOrganization: SubOrganization = {
      organizationId: whoamiResult.organizationId,
      organizationName: whoamiResult.organizationName,
    };

    await setStorageValue(StorageKeys.CurrentUser, currentUser);
    await setStorageValue(
      StorageKeys.CurrentSubOrganization,
      currentSubOrganization
    );

    return whoamiResult;
  };

  createSigningSessionKey = async (params: {
    duration: number;
  }): Promise<SdkApiTypes.TCreateApiKeysResponse> => {
    const currentUser = await getStorageValue(StorageKeys.CurrentUser);
    const ec = new elliptic.ec("p256");
    const keyPair = ec.genKeyPair();

    const signingSession: SigningSession = {
      publicKey: keyPair.getPublic(true, "hex"),
      privateKey: keyPair.getPrivate("hex"),
      expiration: Date.now() + params.duration * 1000,
    };

    const response = await this.createApiKeys({
      apiKeys: [
        {
          apiKeyName: `Short-lived Signing Session Key ${Date.now()}`,
          publicKey: signingSession.publicKey,
          expirationSeconds: `${params.duration}`,
        },
      ],
      userId: currentUser!.userId,
    });

    if (response) {
      setStorageValue(StorageKeys.CurrentSigningSession, signingSession);
    }

    return response;
  };
}
