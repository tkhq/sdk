import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { getWebAuthnAttestation } from "@turnkey/http";

import type {
  TurnkeySDKClientConfig,
  TurnkeySDKBrowserConfig
} from "./__types__/base";

import { TurnkeySDKClientBase } from "./__generated__/sdk-client-base";
import type * as SdkApiTypes from "./__generated__/sdk_api_types";

import elliptic from 'elliptic';

import type { User, SubOrganization, UserSigningSession } from "./models";
import { StorageKeys, getStorageValue, removeStorageValue, setStorageValue } from "./storage";
import { generateRandomBuffer, base64UrlEncode } from "./utils";

export class TurnkeyBrowserSDK {
  config: TurnkeySDKBrowserConfig;

  constructor(config: TurnkeySDKBrowserConfig) {
    this.config = config;
  }

  userPasskey = (): TurnkeySDKBrowserClient => {
    const webauthnStamper = new WebauthnStamper({
      rpId: this.config.rpId
    });

    return new TurnkeySDKBrowserClient({
      stamper: webauthnStamper,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.rootOrganizationId
    });
  }

  email = async (iframeContainer: HTMLElement | null | undefined): Promise<TurnkeySDKBrowserClient> => {
    const TurnkeyIframeElementId = "turnkey-auth-iframe-element-id";

    const iframeStamper = new IframeStamper({
      iframeUrl: this.config.iframeUrl,
      iframeElementId: TurnkeyIframeElementId,
      iframeContainer: iframeContainer
    });

    await iframeStamper.init();

    return new TurnkeySDKBrowserClient({
      stamper: iframeStamper,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.rootOrganizationId
    });
  }

  session = (): TurnkeySDKBrowserClient => {
    const sessionStamper = new ApiKeyStamper({
      apiPublicKey: "0380faf5d7da3cfe4e61ad4d631418cf446f1a700a7e0e481ac232125109b22bb9",
      apiPrivateKey: "584cd7ec333dc2b6f629faadcfbc87c64d8f42d9aae0c91d0114aa41606faba2"
    });

    return new TurnkeySDKBrowserClient({
      stamper: sessionStamper,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.rootOrganizationId
    })
  }

  local = (): TurnkeyLocalClient => {
    return new TurnkeyLocalClient();
  }

  apiProxy = (): TurnkeyAPIProxyClient => {
    return new TurnkeyAPIProxyClient();
  }
}

export class TurnkeyLocalClient {
  getCurrentSubOrganization = async (): Promise<SubOrganization | undefined> => {
    return await getStorageValue(StorageKeys.CurrentSubOrganization)
  }

  getCurrentUser = async (): Promise<User | undefined> => {
    return await getStorageValue(StorageKeys.CurrentUser);
  }

  isSigningSessionActive = async (): Promise<boolean> => {
    return false;
  }

  logoutUser = async (): Promise<boolean> => {
    await removeStorageValue(StorageKeys.CurrentUser);
    await removeStorageValue(StorageKeys.CurrentSubOrganization);
    return true;
  }
}

export class TurnkeySDKBrowserClient extends TurnkeySDKClientBase {
  localClient: TurnkeyLocalClient;

  constructor(config: TurnkeySDKClientConfig) {
    super(config);
    this.localClient = new TurnkeyLocalClient();
  }

  login = async (): Promise<SdkApiTypes.TGetWhoamiResponse> => {
    const whoamiResult = await this.getWhoami({});
    const currentUser: User = {
      userId: whoamiResult.userId,
      username: whoamiResult.username
    }
    const currentSubOrganization: SubOrganization = {
      organizationId: whoamiResult.organizationId,
      organizationName: whoamiResult.organizationName
    }
    await setStorageValue(StorageKeys.CurrentUser, currentUser);
    await setStorageValue(StorageKeys.CurrentSubOrganization, currentSubOrganization);
    return whoamiResult;
  }

  createSigningSessionKey = async (params: { duration: number }): Promise<SdkApiTypes.TCreateApiKeysResponse> => {
    const currentUser = await this.localClient.getCurrentUser();
    const ec = new elliptic.ec("p256");
    const keyPair = ec.genKeyPair();

    const signingSession: UserSigningSession = {
      publicKey: keyPair.getPublic(true, 'hex'),
      privateKey: keyPair.getPrivate('hex'),
      expiration: (Date.now() + params.duration)
    }

    const response = await this.createApiKeys({
      apiKeys: [{
        apiKeyName: "Temporary Signing Session Key",
        publicKey: signingSession.publicKey,
        expirationSeconds: `${params.duration}`
      }],
      userId: currentUser!.userId
    })

    if (response) {
      setStorageValue(StorageKeys.CurrentUserSigningSession, signingSession);
    }

    return response;
  }

}

export class TurnkeyAPIProxyClient {

  createUserAccount = async (email: string, params?: Record<any, any>): Promise<SdkApiTypes.TCreateSubOrganizationResponse> => {
    const challenge = generateRandomBuffer();
    const encodedChallenge = base64UrlEncode(challenge);
    const authenticatorUserId = generateRandomBuffer();

    const attestation = await getWebAuthnAttestation({
      publicKey: {
        rp: {
          id: "localhost",
          name: "Demo Passkey Wallet"
        },
        challenge,
        pubKeyCredParams: [
          {
            type: "public-key",
            alg: -7
          }
        ],
        user: {
          id: authenticatorUserId,
          name: email,
          displayName: email
        },
        authenticatorSelection: {
          requireResidentKey: true,
          residentKey: "required",
          userVerification: "preferred"
        }
      }
    })

    // API Proxy Call
    // email, encodedChallenge, attestation
  }

}
