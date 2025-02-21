import type { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { getWebAuthnAttestation } from "@turnkey/http";

import { AuthClient, TurnkeySDKClientConfig } from "@types";
import { TurnkeyBrowserClient } from "@browser-client";

import type { ReadWriteSession, Passkey } from "@models";

import { StorageKeys, getStorageValue, saveSession } from "@storage";

import {
  generateRandomBuffer,
  base64UrlEncode,
  createEmbeddedAPIKey,
} from "@utils";

import { DEFAULT_SESSION_EXPIRATION_IN_SECONDS } from "@constants";

export class TurnkeyPasskeyClient extends TurnkeyBrowserClient {
  rpId: string;

  constructor(config: TurnkeySDKClientConfig) {
    console.log("config", config);
    super(config, AuthClient.Passkey);
    this.rpId = (this.stamper as WebauthnStamper)!.rpId;
  }

  /**
   * Create a passkey for an end-user, taking care of various lower-level details.
   *
   * @returns {Promise<Passkey>}
   */
  createUserPasskey = async (
    config: Record<any, any> = {}
  ): Promise<Passkey> => {
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
    // TODO: consider un-nesting these config params
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
          {
            type: "public-key",
            alg: -257,
          },
        ],
        user: {
          id: config.publicKey?.user?.id ?? authenticatorUserId,
          name: config.publicKey?.user?.name ?? "Default User",
          displayName: config.publicKey?.user?.displayName ?? "Default User",
        },
        authenticatorSelection: {
          authenticatorAttachment:
            config.publicKey?.authenticatorSelection?.authenticatorAttachment ??
            undefined, // default to empty
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
      attestation,
    };
  };

  /**
   * Uses passkey authentication to create a read-write session, via an embedded API key,
   * and stores + returns the resulting auth bundle that contains the encrypted API key.
   * This auth bundle (also referred to as a credential bundle) can be injected into an `iframeStamper`,
   * resulting in a touch-free authenticator. Unlike `loginWithReadWriteSession`, this method
   * assumes the end-user's organization ID (i.e. the sub-organization ID) is already known.
   *
   * @param userId
   * @param targetEmbeddedKey
   * @param expirationSeconds
   * @param curveType
   * @returns {Promise<ReadWriteSession>}
   */
  createPasskeySession = async (
    userId: string,
    targetEmbeddedKey: string,
    expirationSeconds: string = DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
    organizationId?: string
  ): Promise<ReadWriteSession> => {
    const user = await getStorageValue(StorageKeys.UserSession);
    organizationId = organizationId ?? user?.organization.organizationId;

    if (!organizationId) {
      throw new Error(
        "Error creating passkey session: Organization ID is required"
      );
    }

    userId = userId ?? user?.userId;

    const { authBundle: credentialBundle, publicKey } =
      await createEmbeddedAPIKey(targetEmbeddedKey);

    // add API key to Turnkey User
    await this.createApiKeys({
      organizationId,
      userId,
      apiKeys: [
        {
          apiKeyName: `Session Key ${String(Date.now())}`,
          publicKey,
          expirationSeconds,
          curveType: "API_KEY_CURVE_P256",
        },
      ],
    });

    const expiry = Date.now() + Number(expirationSeconds) * 1000;

    await saveSession(
      {
        organizationId,
        organizationName: user?.organization.organizationName ?? "",
        userId,
        username: user?.username ?? "",
        credentialBundle,
        sessionExpiry: expiry,
      },
      this.authClient
    );

    return {
      credentialBundle,
      expiry,
    };
  };
}
