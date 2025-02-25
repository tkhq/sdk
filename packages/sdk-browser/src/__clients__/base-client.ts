import type { TurnkeySDKClientConfig, AuthClient } from "@types";
import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";

// TurnkeySDKClientBase is a generated class that provides the base methods for the client
// This class extends that class and adds additional methods for the browser client
export abstract class TurnkeyBaseClient extends TurnkeySDKClientBase {
  authClient?: AuthClient | undefined;

  constructor(config: TurnkeySDKClientConfig, authClient?: AuthClient) {
    super(config);
    this.authClient = authClient;
  }
}
