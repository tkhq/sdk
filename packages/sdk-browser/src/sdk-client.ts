import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { IframeStamper } from "@turnkey/iframe-stamper";
import bs58check from "bs58check";
import { AeadId, CipherSuite, KdfId, KemId } from "hpke-js";
import { uint8ArrayFromHexString } from "@turnkey/encoding";
import { getWebAuthnAttestation } from "@turnkey/http";
import {
  generateP256KeyPair,
  buildAdditionalAssociatedData,
  compressRawPublicKey,
} from "@turnkey/crypto";

import { VERSION } from "./__generated__/version";
import WindowWrapper from "./__polyfills__/window";

import type {
  GrpcStatus,
  TurnkeySDKClientConfig,
  TurnkeySDKBrowserConfig,
  IframeClientParams,
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

  iframeClient = async (
    params: IframeClientParams
  ): Promise<TurnkeyIframeClient> => {
    if (!params.iframeUrl) {
      throw new Error(
        "Tried to initialize iframeClient with no iframeUrl defined"
      );
    }

    const TurnkeyIframeElementId =
      params.iframeElementId ?? "turnkey-default-iframe-element-id";

    const iframeStamper = new IframeStamper({
      iframeContainer: params.iframeContainer,
      iframeUrl: params.iframeUrl,
      iframeElementId: TurnkeyIframeElementId,
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

  // Local Storage
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

  getAuthBundle = async (): Promise<string | undefined> => {
    return await getStorageValue(StorageKeys.AuthBundle);
  };
}

export class TurnkeyBrowserClient extends TurnkeySDKClientBase {
  constructor(config: TurnkeySDKClientConfig) {
    super(config);
  }

  login = async (): Promise<SdkApiTypes.TCreateReadOnlySessionResponse> => {
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

  createPasskeySession = async (
    userId: string,
    targetEmbeddedKey: string,
    expirationSeconds?: string
  ) => {
    const TURNKEY_HPKE_INFO = new TextEncoder().encode("turnkey_hpke");

    const localStorageUser = await getStorageValue(StorageKeys.CurrentUser);
    userId = userId ?? localStorageUser?.userId;

    // 1: create api key (to later encrypt)
    const p256key = generateP256KeyPair();

    // 2: add API key to Turnkey User
    await this.createApiKeys({
      userId,
      apiKeys: [
        {
          apiKeyName: `Session Key ${String(Date.now())}`,
          publicKey: p256key.publicKey,
          expirationSeconds: expirationSeconds ?? "900", // default to 15 minutes
        },
      ],
    });

    // 3: set up encryption
    const suite = new CipherSuite({
      kem: KemId.DhkemP256HkdfSha256,
      kdf: KdfId.HkdfSha256,
      aead: AeadId.Aes256Gcm,
    });

    // 4: import the target embedded key (passed in from the iframe)
    const targetKeyBytes = uint8ArrayFromHexString(targetEmbeddedKey);
    const targetKey = await crypto.subtle.importKey(
      "raw",
      targetKeyBytes,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      []
    );

    // 5: sender encrypts a message with the recipient public key
    const sender = await suite.createSenderContext({
      recipientPublicKey: targetKey,
      info: TURNKEY_HPKE_INFO,
    });
    const ciphertext = await sender.seal(
      uint8ArrayFromHexString(p256key.privateKey),
      buildAdditionalAssociatedData(new Uint8Array(sender.enc), targetKeyBytes)
    );
    const ciphertextUint8Array = new Uint8Array(ciphertext);

    // 6: assemble bundle
    const encappedKey = new Uint8Array(sender.enc);
    const compressedEncappedKey = compressRawPublicKey(encappedKey);
    const result = new Uint8Array(
      compressedEncappedKey.length + ciphertextUint8Array.length
    );
    result.set(compressedEncappedKey);
    result.set(ciphertextUint8Array, compressedEncappedKey.length);

    const base58encodedBundle = bs58check.encode(result);

    // 7: store auth bundle in local storage
    await setStorageValue(StorageKeys.AuthBundle, base58encodedBundle);

    return base58encodedBundle;
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
    return await stamper.injectWalletExportBundle(
      credentialBundle,
      organizationId
    );
  };

  injectKeyExportBundle = async (
    credentialBundle: string,
    organizationId: string
  ): Promise<boolean> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.injectKeyExportBundle(
      credentialBundle,
      organizationId
    );
  };

  injectImportBundle = async (
    bundle: string,
    organizationId: string,
    userId: string
  ): Promise<boolean> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.injectImportBundle(bundle, organizationId, userId);
  };

  extractWalletEncryptedBundle = async (): Promise<string> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.extractWalletEncryptedBundle();
  };

  extractKeyEncryptedBundle = async (): Promise<string> => {
    const stamper = this.config.stamper as IframeStamper;
    return await stamper.extractKeyEncryptedBundle();
  };
}
