import { type IframeStamper, type KeyFormat } from "@turnkey/iframe-stamper";

import { TurnkeyBrowserClient } from "./browser-client";

import { type TurnkeySDKClientConfig, AuthClient } from "../__types__/base";

export class TurnkeyIframeClient extends TurnkeyBrowserClient {
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
}
