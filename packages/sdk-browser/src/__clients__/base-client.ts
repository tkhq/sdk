import type { TurnkeySDKClientConfig, AuthClient } from "@types";
import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";

export abstract class TurnkeyBaseClient extends TurnkeySDKClientBase {
  authClient?: AuthClient | undefined;

  constructor(config: TurnkeySDKClientConfig, authClient?: AuthClient) {
    super(config);
    this.authClient = authClient;
  }
}
