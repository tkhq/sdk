import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { IframeStamper } from "@turnkey/iframe-stamper";
import bs58check from "bs58check";
import { AeadId, CipherSuite, KdfId, KemId } from "hpke-js";
import {
  uint8ArrayToHexString,
  uint8ArrayFromHexString,
} from "@turnkey/encoding";
import { getWebAuthnAttestation } from "@turnkey/http";

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

  // Create a temporary "passkey session" by leveraging the Auth iframe and some cryptography.
  // 1. Stand up iframe (auth.turnkey.com) and get target embedded key
  // 2. Create a new P256 keypair (using @turnkey/crypto)
  // 3. Encrypt private key (from step 2) to public key (from step 1)
  // 4. Return public key (from step 2) and encrypted private key (from step 3)
  // 5. Make `createApiKeys` activity (using the public key) to create a temporary API session key.
  //
  // Params: target embedded key (iframe), session duration
  // Returns: public key, encrypted API private key (which can always be decrypted by the iframe) --> base58 encoded (CompressedEncappedPublicKey||Ciphertext)
  createPasskeySession = async (
    userId: string,
    targetEmbeddedKey: string, // this is what we're going to encrypt the private key to
    expirationSeconds: string
  ) => {
    // If local storage contains the encrypted key, then use it. OR just create a new session each time.

    const localStorageUser = await getStorageValue(StorageKeys.CurrentUser);
    userId = userId ?? localStorageUser?.userId;

     // Step 2: create api key (to later encrypt)
     const p256key = await crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      ["deriveKey"] // no more derive bits
    );

    // Next, get private key into an encrypt-able state
    const exportedPrivateKey = await crypto.subtle.exportKey(
      "pkcs8",
      p256key.privateKey
    );

    const exportedPublicKey = await crypto.subtle.exportKey(
      "raw",
      p256key.publicKey,
    );
    console.log("exported public key", exportedPublicKey);
  
    const compressedPublicKey = compressPubKey(new Uint8Array(exportedPublicKey));
    console.log("compressed public key", compressedPublicKey);

    // now create it using turnkey API
    const createApiKeysResult = await this.createApiKeys({
      apiKeys: [{
        apiKeyName: "Session Key",
        publicKey: uint8ArrayToHexString(compressedPublicKey),
        expirationSeconds,
      }],
      userId,
    });
    console.log('create api keys result', createApiKeysResult);

    const suite = new CipherSuite({
      kem: KemId.DhkemP256HkdfSha256,
      kdf: KdfId.HkdfSha256,
      aead: AeadId.Aes256Gcm,
    });

    const TURNKEY_HPKE_INFO = new TextEncoder().encode("turnkey_hpke");

    // Step 3: import the target embedded key (from the iframe) and derive a shared key using it and the host key
    const targetKeyBytes = uint8ArrayFromHexString(targetEmbeddedKey);
    const targetKey = await crypto.subtle.importKey(
      "raw", // Assuming the key is in compressed format
      targetKeyBytes,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      []
    );

    // A sender encrypts a message with the recipient public key.
    const sender = await suite.createSenderContext({
      recipientPublicKey: targetKey,
      info: TURNKEY_HPKE_INFO,
    });

    // This is in a "processed" format; we need to manipulate to get the raw 32-byte private key
    const privateKeyBytes = new Uint8Array(exportedPrivateKey);
    console.log("private key bytes:", privateKeyBytes);

    // Convert exported private key to Uint8Array
    const rawPrivateKeyBytesPKCS8 = new Uint8Array(exportedPrivateKey);

    // PKCS#8 private key is structured with the key data at a specific position
    // The actual key starts at byte 36 and is 32 bytes long
    const rawTurnkeyApiPrivateKey = rawPrivateKeyBytesPKCS8.slice(36, 36 + 32);
    console.log("raw private key", rawTurnkeyApiPrivateKey);

    // Step 5: perform encryption
    const ciphertext = await sender.seal(
      rawTurnkeyApiPrivateKey,
      additionalAssociatedData(new Uint8Array(sender.enc), targetKeyBytes)
    );
    const ciphertextUint8Array = new Uint8Array(ciphertext);
    console.log("ciphertext uint8array", ciphertextUint8Array);

    // Step 6: assemble bundle
    const encappedKey = new Uint8Array(sender.enc);
    const compressedEncappedKey = compressPubKey(encappedKey);
    const result = new Uint8Array(
      compressedEncappedKey.length + ciphertextUint8Array.length
    );
    result.set(compressedEncappedKey);
    result.set(ciphertextUint8Array, compressedEncappedKey.length);
    console.log("raw result", result);

    // The equivalent of the email auth bundle. Can store in local storage
    const base58encodedBundle = bs58check.encode(result);
    console.log("resulting bundle", base58encodedBundle);

    // Store auth bundle in local storage
    await setStorageValue(StorageKeys.AuthBundle, base58encodedBundle);

    return base58encodedBundle;
  };
}

/**
 * Create additional associated data (AAD) for AES-GCM decryption.
 */
const additionalAssociatedData = (
  senderPubBuf: Uint8Array,
  receiverPubBuf: Uint8Array,
): Uint8Array => {
  return new Uint8Array([
    ...Array.from(senderPubBuf),
    ...Array.from(receiverPubBuf),
  ]);
};

export const compressPubKey = (publicKey: Uint8Array): Uint8Array => {
  // The first byte of a "raw" public key indicates whether it is compressed or uncompressed
  // 0x04 indicates that the key is uncompressed
  if (publicKey[0] !== 0x04) {
    throw new Error("unexpected pubkey format");
  }

  // Compress the public key:
  // We keep the x-coordinate and determine the parity of the y-coordinate
  const x = publicKey.slice(1, 1 + 32); // The x-coordinate
  const y = publicKey.slice(33, 33 + 32); // The y-coordinate
  const yIsEven = y[31]! % 2 === 0;

  // Compressed form: 0x02 or 0x03 (based on y's parity) followed by x
  const compressedKey = new Uint8Array(33);
  compressedKey[0] = yIsEven ? 0x02 : 0x03; // Set the first byte depending on the parity of y
  compressedKey.set(x, 1); // Set the x-coordinate

  return compressedKey;
};

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
