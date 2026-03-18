import type { TStamp, TStamper } from "@turnkey/sdk-types";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import type { CrossPlatformApiKeyStamper } from "../api/base";
import { SignatureFormat } from "@turnkey/api-key-stamper";
import { stringToBase64urlString } from "@turnkey/encoding";

type AttestedScheme =
  | "STAMP_ATTESTED_SCHEME_P256_OIDC"
  | "STAMP_ATTESTED_SCHEME_P256_VERIFICATION_TOKEN";

export class AttestedStamper implements TStamper {
  private apiKeyStamper: CrossPlatformApiKeyStamper;
  public attestedIdentity?: string | undefined;
  public publicKey?: string | undefined;
  private scheme: AttestedScheme =
    "STAMP_ATTESTED_SCHEME_P256_VERIFICATION_TOKEN";

  constructor(apiKeyStamper: CrossPlatformApiKeyStamper) {
    this.apiKeyStamper = apiKeyStamper;
  }

  setAttestedIdentity(attestedIdentity: string): void {
    this.attestedIdentity = attestedIdentity;
  }

  getAttestedIdentity(): string | undefined {
    return this.attestedIdentity;
  }

  clearAttestedIdentity(): void {
    this.attestedIdentity = undefined;
  }

  setPublicKey(publicKey: string): void {
    this.publicKey = publicKey;
  }

  getPublicKey(): string | undefined {
    return this.publicKey;
  }

  clearPublicKey(): void {
    this.publicKey = undefined;
  }

  setScheme(scheme: AttestedScheme): void {
    this.scheme = scheme;
  }

  getScheme(): AttestedScheme {
    return this.scheme;
  }

  async stamp(payload: string): Promise<TStamp> {
    if (!this.attestedIdentity) {
      throw new TurnkeyError(
        "Attested identity not set. Please call setAttestedIdentity() before stamping.",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    if (!this.publicKey) {
      throw new TurnkeyError(
        "Attested public key not set. Please call setPublicKey() before stamping.",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    const signature = await this.apiKeyStamper.sign(
      payload,
      SignatureFormat.Der,
      this.publicKey,
    );

    const stamp = {
      publicKeyAttestation: this.attestedIdentity,
      scheme: this.scheme,
      publicKey: this.publicKey,
      signature,
    };

    const stampHeaderName = "X-Stamp-Attested";
    return {
      stampHeaderName,
      stampHeaderValue: stringToBase64urlString(JSON.stringify(stamp)),
    };
  }
}
