import { ApiKeyStamper } from "@turnkey/api-key-stamper";

import type {
  TurnkeySDKClientConfig,
  TurnkeySDKServerConfig
} from "./__types__/base";

import { TurnkeySDKClientBase } from "./__generated__/sdk-client-base";
import type * as SdkApiTypes from "./__generated__/sdk_api_types";

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

  apiProxy = async (methodName: string, params: any[]): Promise<any> => {
    const apiClient = this.api();
    const method = apiClient[methodName];
    if (typeof method === 'function') {
      return await method(...params);
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

  createUserAccount = async (email: string, encodedChallenge: string, attestation: any): Promise<SdkApiTypes.TCreateSubOrganizationResponse> => {

    const subOrganizationResult = await this.createSubOrganization({
      subOrganizationName: email,
      rootUsers: [{
        userName: email,
        apiKeys: [],
        authenticators: [{
          authenticatorName: "test-passkey-1",
          challenge: encodedChallenge,
          attestation: attestation
        }]
      }],
      rootQuorumThreshold: 1,
      wallet: {
        walletName: "Test Wallet 1",
        accounts: [
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: "m/44'/60'/0'/0/0",
            addressFormat: "ADDRESS_FORMAT_ETHEREUM"
          }
        ]
      }
    })

    return subOrganizationResult;
  }

}
