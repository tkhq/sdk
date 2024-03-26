import { ApiKeyStamper } from "@turnkey/api-key-stamper";

import type {
  TurnkeySDKClientConfig,
  TurnkeySDKServerConfig
} from "./__types__/base";

import { TurnkeySDKClientBase } from "./__generated__/sdk-client-base";

export class TurnkeyServerSDK {
  config: TurnkeySDKServerConfig;

  constructor(config: TurnkeySDKServerConfig) {
    this.config = config;
  }

  api = (): TurnkeySDKServerClient => {
    const apiKeyStamper = new ApiKeyStamper({
      apiPublicKey: this.config.apiPublicKey,
      apiPrivateKey: this.config.apiPrivateKey
    });

    return new TurnkeySDKServerClient({
      stamper: apiKeyStamper,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.rootOrganizationId
    });
  }

  apiProxy = async (methodName: string, args: any[]): Promise<any> => {
    const apiClient = this.api();
    const method = apiClient[methodName];
    if (typeof method === 'function') {
      return await method(...args);
    } else {
      throw new Error(`Method: ${methodName} does not exist on TurnkeySDKClient`);
    }
  }
}

export class TurnkeySDKServerClient extends TurnkeySDKClientBase {
  constructor(config: TurnkeySDKClientConfig) {
    super(config);
  }

  [methodName: string]: any;
}
