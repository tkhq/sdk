import type { TStamp, TStamper } from "@turnkey/sdk-types";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import type { CrossPlatformApiKeyStamper } from "../api/base";
import { SignatureFormat } from "@turnkey/api-key-stamper";
import { stringToBase64urlString } from "@turnkey/encoding";

export class AttestedStamper implements TStamper {
  private apiKeyStamper: CrossPlatformApiKeyStamper;
  public attestedIdentity?: string | undefined;
  constructor(apiKeyStamper: CrossPlatformApiKeyStamper) {
    this.apiKeyStamper = apiKeyStamper;
  }

  setattestedIdentity(attestedIdentity: string): void {
    this.attestedIdentity = attestedIdentity;
  }

  getattestedIdentity(): string | undefined {
    return this.attestedIdentity;
  }

  clearattestedIdentity(): void {
    this.attestedIdentity = undefined;
  }

  async stamp(payload: string): Promise<TStamp> {
    if (!this.attestedIdentity) {
      throw new TurnkeyError(
        "Attested identity not set. Please call setattestedIdentity() before stamping.",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }

    const signature = await this.apiKeyStamper.sign(
      payload,
      SignatureFormat.Der,
    );
    const publicKeyHex = await this.apiKeyStamper.getPublicKey();

    const stamp = {
      PublicKeyAttestation: this.attestedIdentity,
      Scheme: "SIGNATURE_SCHEME_TK_API_P256",
      PublicKey: publicKeyHex,
      Signature: signature,
    };

    const stampHeaderName = "X-Stamp";
    return {
      stampHeaderName,
      stampHeaderValue: stringToBase64urlString(JSON.stringify(stamp)),
    };
  }
}
