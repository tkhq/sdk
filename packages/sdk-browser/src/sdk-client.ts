import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { getWebAuthnAttestation } from "@turnkey/http";

import { VERSION } from "./__generated__/version";
import WindowWrapper from "./__polyfills__/window";

import type {
  GrpcStatus,
  TurnkeySDKClientConfig,
  TurnkeySDKBrowserConfig,
  IframeClientParams
} from "./__types__/base";

import { TurnkeyRequestError } from "./__types__/base";

import { TurnkeySDKClientBase } from "./__generated__/sdk-client-base";
import type * as SdkApiTypes from "./__generated__/sdk_api_types";

import type { User, SubOrganization } from "./models";
import {
  StorageKeys,
  getStorageValue,
  removeStorageValue,
  setStorageValue,
} from "./storage";
import { generateRandomBuffer, base64UrlEncode } from "./utils";

export class TurnkeyBrowserSDK {
  config: TurnkeySDKBrowserConfig;

  constructor(config: TurnkeySDKBrowserConfig) {
    this.config = config;
  }

  currentUserSession = async (): Promise<TurnkeyBrowserClient | undefined> => {
    const currentUser = await this.getCurrentUser();
    if (!currentUser?.readOnlySession) {
      return;
    }
    if (currentUser?.readOnlySession?.sessionExpiry > Date.now()) {
      return new TurnkeyBrowserClient({
        readOnlySession: currentUser?.readOnlySession?.session!,
        apiBaseUrl: this.config.apiBaseUrl,
        organizationId:
          currentUser?.organization?.organizationId ??
          this.config.defaultOrganizationId,
      });
    } else {
      this.logoutUser();
    }
    return;
  };

  passkeyClient = (rpId?: string): TurnkeyPasskeyClient => {
    const targetRpId =
      rpId ?? this.config.rpId ?? WindowWrapper.location.hostname;

    if (!targetRpId) {
      throw new Error(
        "Tried to initialize a passkey client with no rpId defined"
      );
    }

    const webauthnStamper = new WebauthnStamper({
      rpId: targetRpId,
    });

    return new TurnkeyPasskeyClient({
      stamper: webauthnStamper,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.defaultOrganizationId,
    });
  };

  iframeClient = async (params: IframeClientParams): Promise<TurnkeyIframeClient> => {
    const targetIframeUrl = params.iframeUrl;

    if (!targetIframeUrl) {
      throw new Error(
        "Tried to initialize iframeClient with no iframeUrl defined"
      );
    }

    const TurnkeyIframeElementId = params.iframeElementId ?? "turnkey-iframe-element-id";

    const iframeStamper = new IframeStamper({
      iframeContainer: params.iframeContainer,
      iframeUrl: targetIframeUrl,
      iframeElementId: TurnkeyIframeElementId
    });

    await iframeStamper.init();

    return new TurnkeyIframeClient({
      stamper: iframeStamper,
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
  };

  // Local
  getCurrentSubOrganization = async (): Promise<
    SubOrganization | undefined
  > => {
    const currentUser = await this.getCurrentUser();
    return currentUser?.organization;
  };

  getCurrentUser = async (): Promise<User | undefined> => {
    return await getStorageValue(StorageKeys.CurrentUser);
  };

  logoutUser = async (): Promise<boolean> => {
    await removeStorageValue(StorageKeys.CurrentUser);

    return true;
  };
}

export class TurnkeyBrowserClient extends TurnkeySDKClientBase {
  constructor(config: TurnkeySDKClientConfig) {
    super(config);
  }

  login = async (): Promise<SdkApiTypes.TGetWhoamiResponse> => {
    const readOnlySessionResult = await this.createReadOnlySession({});
    const org = {
      organizationId: readOnlySessionResult!.organizationId,
      organizationName: readOnlySessionResult!.organizationName,
    };
    const currentUser: User = {
      userId: readOnlySessionResult!.userId,
      username: readOnlySessionResult!.username,
      organization: org,
      readOnlySession: {
        session: readOnlySessionResult!.session,
        sessionExpiry: Number(readOnlySessionResult!.sessionExpiry),
      },
    };
    await setStorageValue(StorageKeys.CurrentUser, currentUser);
    return readOnlySessionResult!;
  };
}

export class TurnkeyPasskeyClient extends TurnkeyBrowserClient {
  rpId: string;

  constructor(config: TurnkeySDKClientConfig) {
    super(config);
    this.rpId = (config.stamper as WebauthnStamper)!.rpId;
  }

  createUserPasskey = async (config: Record<any, any> = {}) => {
    const challenge = generateRandomBuffer();
    const encodedChallenge = base64UrlEncode(challenge);
    const authenticatorUserId = generateRandomBuffer();

    // WebAuthn credential options options can be found here:
    // https://www.w3.org/TR/webauthn-2/#sctn-sample-registration
    //
    // All pubkey algorithms can be found here: https://www.iana.org/assignments/cose/cose.xhtml#algorithms
    // Turnkey only supports ES256 (-7) and RS256 (-257)
    //
    // The pubkey type only supports one value, "public-key"
    // See https://www.w3.org/TR/webauthn-2/#enumdef-publickeycredentialtype for more details
    const webauthnConfig: CredentialCreationOptions = {
      publicKey: {
        rp: {
          id: config.publicKey?.rp?.id ?? this.rpId,
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
          name: config.publicKey?.user?.name ?? "Default User",
          displayName: config.publicKey?.user?.displayName ?? "Default User",
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
}

export class TurnkeyIframeClient extends TurnkeyBrowserClient {
  iframePublicKey: string | null;

  constructor(config: TurnkeySDKClientConfig) {
    super(config);
    this.iframePublicKey = (config.stamper as IframeStamper).iframePublicKey;
  }

  injectCredentialBundle = async (
    credentialBundle: string
  ): Promise<boolean> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.injectCredentialBundle(credentialBundle);
  };

  injectWalletExportBundle = async (
    credentialBundle: string,
    organizationId: string
  ): Promise<boolean> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.injectWalletExportBundle(credentialBundle, organizationId);
  }

  injectKeyExportBundle = async (
    credentialBundle: string,
    organizationId: string
  ): Promise<boolean> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.injectKeyExportBundle(
      credentialBundle,
      organizationId
    )
  }

  injectImportBundle = async (
    bundle: string,
    organizationId: string,
    userId: string
  ): Promise<boolean> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.injectImportBundle(
      bundle,
      organizationId,
      userId
    );
  }

  extractWalletEncryptedBundle = async (): Promise<string> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.extractWalletEncryptedBundle();
  }

}
