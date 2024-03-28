import { ApiKeyStamper } from "@turnkey/api-key-stamper";

import type {
  TurnkeySDKClientConfig,
  TurnkeySDKServerConfig
} from "./__types__/base";

import { TurnkeySDKClientBase } from "./__generated__/sdk-client-base";
import type * as SdkApiTypes from "./__generated__/sdk_api_types";

import type { Request, Response, RequestHandler } from "express";

const API_PROXY_ALLOWED_METHODS = [
  "createUserAccount",
  "getWalletAccounts",
  "getWallets"
];

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

  expressProxyHandler = (config: Record<string, any>): RequestHandler => {
    const allowedMethods = config.allowedMethods ?? API_PROXY_ALLOWED_METHODS;

    return async (request: Request, response: Response): Promise<void> => {
      const { methodName, params } = request.body;
      if (!methodName || !params) {
        response.status(400).send("methodName and params are required.");
      }

      try {
        if (allowedMethods.includes(methodName)) {
          const result = await this.apiProxy(methodName, params);
          response.json(result);
        } else {
          response.status(401).send("Unauthorized proxy method");
        }
        return;
      } catch (error) {
        if (error instanceof Error) {
          response.status(500).send(error.message);
        } else {
          response.status(500).send('An unexpected error occurred');
        }
        return;
      }
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
