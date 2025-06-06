import { IndexedDbStamper } from "@turnkey/indexed-db-stamper";
import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import WindowWrapper from "@polyfills/window";

export class TurnkeyClient {
  config: any; // Type TBD
  httpClient: TurnkeySDKClientBase;
  indexedDBStamper: IndexedDbStamper | undefined;
  passkeyStamper: WebauthnStamper | undefined;
  constructor(
    config: any,
    indexedDBStamper?: IndexedDbStamper,
    passkeyStamper?: WebauthnStamper
  ) {
    this.config = config;
    this.indexedDBStamper = indexedDBStamper || new IndexedDbStamper();
    this.passkeyStamper =
      passkeyStamper ||
      new WebauthnStamper({
        rpId: config?.passkeyConfig?.rpId ?? WindowWrapper.location.hostname,
        ...(config?.passkeyConfig?.timeout !== undefined && {
          timeout: config?.passkeyConfig?.timeout,
        }),
        ...(config?.passkeyConfig?.userVerification !== undefined && {
          userVerification: config?.passkeyConfig?.userVerification,
        }),
        ...(config?.passkeyConfig?.allowCredentials !== undefined && {
          allowCredentials: config?.passkeyConfig?.allowCredentials,
        }),
      });

    this.indexedDBStamper.init();

    this.httpClient = new TurnkeySDKClientBase({
      stamper: this.indexedDBStamper, // Maybe we should rename this
      passkeyStamper: this.passkeyStamper,
      ...config,
    });
  }
}
