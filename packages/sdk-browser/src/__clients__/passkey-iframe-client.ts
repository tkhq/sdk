import type { IframeStamper, KeyFormat } from "@turnkey/iframe-stamper";
import { AuthClient, SessionType, TurnkeySDKClientConfig } from "@types";
import { TurnkeyBrowserClient } from "@browser-client";
import { Session, storeSession } from "@storage";
import { TurnkeyIframeClient } from "@iframe-client";

export class TurnkeyPasskeyIframeClient extends TurnkeyBrowserClient {
  iframePublicKey: string | null;

  constructor(config: TurnkeySDKClientConfig) {
    super(config, AuthClient.Iframe);
    this.iframePublicKey = (this.stamper as IframeStamper).iframePublicKey;
  }

  injectCredentialBundle = async (
    credentialBundle: string
  ): Promise<boolean> => {
    return await (this.stamper as IframeStamper).injectCredentialBundle(
      credentialBundle
    );
  };

  injectWalletExportBundle = async (
    credentialBundle: string,
    organizationId: string
  ): Promise<boolean> => {
    return await (this.stamper as IframeStamper).injectWalletExportBundle(
      credentialBundle,
      organizationId
    );
  };

  injectKeyExportBundle = async (
    credentialBundle: string,
    organizationId: string,
    keyFormat?: KeyFormat | undefined
  ): Promise<boolean> => {
    return await (this.stamper as IframeStamper).injectKeyExportBundle(
      credentialBundle,
      organizationId,
      keyFormat
    );
  };

  injectImportBundle = async (
    bundle: string,
    organizationId: string,
    userId: string
  ): Promise<boolean> => {
    return await (this.stamper as IframeStamper).injectImportBundle(
      bundle,
      organizationId,
      userId
    );
  };

  extractWalletEncryptedBundle = async (): Promise<string> => {
    return await (this.stamper as IframeStamper).extractWalletEncryptedBundle();
  };

  extractKeyEncryptedBundle = async (): Promise<string> => {
    return await (this.stamper as IframeStamper).extractKeyEncryptedBundle();
  };

  /**
   * Log in with a bundle. This method uses a bundle sent to the end user email
   * To be used in conjunction with an `iframeStamper`.
   *
   * @param bundle
   * @param expirationSeconds
   * @returns {Promise<void>}
   */
  override loginWithBundle = async (
    bundle: string, // we need a way to get the expiry of this token. Either it lives in the token itself or is returned from the server action and passed again here
    expirationSeconds: string // we need a way to get the expiry of this token. Either it lives in the token itself or is returned from the server action and passed again here
  ): Promise<void> => {
    if (this! instanceof TurnkeyIframeClient) {
      await this.injectCredentialBundle(bundle);
    } else {
      // Throw an error if the client is not an iframe client
      throw new Error(
        "You must use an iframe client to log in with a session."
      ); //should we default to a "localStorage" client?
    }
    const whoAmI = await this.getWhoami();

    const session: Session = {
      sessionType: SessionType.READ_WRITE,
      userId: whoAmI.userId,
      organizationId: whoAmI.organizationId,
      expiry: Date.now() + Number(expirationSeconds) * 1000, //TODO change this to the actual expiry time
      token: bundle,
    };
    storeSession(session, AuthClient.Iframe);
  };
}
