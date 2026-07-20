import type { TStamp, TStamper } from "@turnkey/sdk-types";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import type { CrossPlatformApiKeyStamper } from "../api/base";
import { SignatureFormat } from "@turnkey/api-key-stamper";
import { stringToBase64urlString } from "@turnkey/encoding";

export enum AttestedScheme {
  P256_OIDC = "STAMP_ATTESTED_SCHEME_P256_OIDC",
  P256_VERIFICATION_TOKEN = "STAMP_ATTESTED_SCHEME_P256_VERIFICATION_TOKEN",
}

export interface AttestedConfig {
  attestedIdentity: string;
  publicKey: string;
  scheme: AttestedScheme;
}

export class AttestedStamper implements TStamper {
  private apiKeyStamper: CrossPlatformApiKeyStamper;
  public attestedIdentity?: string | undefined;
  public publicKey?: string | undefined;
  private scheme: AttestedScheme = AttestedScheme.P256_VERIFICATION_TOKEN;

  constructor(apiKeyStamper: CrossPlatformApiKeyStamper) {
    this.apiKeyStamper = apiKeyStamper;
  }

  configure(config: AttestedConfig): void {
    this.attestedIdentity = config.attestedIdentity;
    this.publicKey = config.publicKey;
    this.scheme = config.scheme;
  }

  clear(): void {
    this.attestedIdentity = undefined;
    this.publicKey = undefined;
    this.scheme = AttestedScheme.P256_VERIFICATION_TOKEN;
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
