import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";

import type {
  ApiCredentials,
  TurnkeySDKClientConfig,
  TurnkeySDKServerConfig,
  TurnkeyProxyHandlerConfig,
} from "./__types__/base";
import type { TGetSendTransactionStatusResponse } from "./__generated__/sdk_api_types";

import { TurnkeySDKClientBase } from "./__generated__/sdk-client-base";

import type { Request, Response, RequestHandler } from "express";
import type {
  NextApiRequest,
  NextApiResponse,
  NextApiHandler,
} from "./__types__/base";

const DEFAULT_API_PROXY_ALLOWED_METHODS = [
  "oauth",
  "createReadWriteSession",
  "createSubOrganization",
  "emailAuth",
  "initUserEmailRecovery",
];

export type PollTransactionStatusParams = {
  organizationId?: string;
  sendTransactionStatusId: string;
  pollingIntervalMs?: number;
  timeoutMs?: number;
};

export class TurnkeyServerSDK {
  config: TurnkeySDKServerConfig;

  protected stamper: ApiKeyStamper | undefined;

  constructor(config: TurnkeySDKServerConfig) {
    this.config = config;
  }

  apiClient = (apiCredentials?: ApiCredentials): TurnkeyApiClient => {
    this.stamper = new ApiKeyStamper({
      apiPublicKey: apiCredentials?.apiPublicKey ?? this.config.apiPublicKey,
      apiPrivateKey: apiCredentials?.apiPrivateKey ?? this.config.apiPrivateKey,
      runtimeOverride: this.config.runtimeOverride,
    });

    return new TurnkeyApiClient({
      stamper: this.stamper,
      apiBaseUrl: this.config.apiBaseUrl,
      organizationId: this.config.defaultOrganizationId,
      activityPoller: this.config.activityPoller,
    });
  };

  apiProxy = async (methodName: string, params: any[]): Promise<any> => {
    const apiClient = this.apiClient();
    const method = apiClient[methodName];
    if (typeof method === "function") {
      return await method(...params);
    } else {
      throw new Error(
        `Method: ${methodName} does not exist on TurnkeySDKClient`,
      );
    }
  };

  expressProxyHandler = (config: TurnkeyProxyHandlerConfig): RequestHandler => {
    const allowedMethods =
      config.allowedMethods ?? DEFAULT_API_PROXY_ALLOWED_METHODS;

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
          response.status(500).send("An unexpected error occurred");
        }
        return;
      }
    };
  };

  nextProxyHandler = (config: TurnkeyProxyHandlerConfig): NextApiHandler => {
    const allowedMethods =
      config.allowedMethods ?? DEFAULT_API_PROXY_ALLOWED_METHODS;

    return async (
      request: NextApiRequest,
      response: NextApiResponse,
    ): Promise<void> => {
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
          response.status(500).send("An unexpected error occurred");
        }
        return;
      }
    };
  };
}

export class TurnkeyServerClient extends TurnkeySDKClientBase {
  constructor(config: TurnkeySDKClientConfig) {
    super(config);
  }

  [methodName: string]: any;
}

export class TurnkeyApiClient extends TurnkeyServerClient {
  constructor(config: TurnkeySDKClientConfig) {
    super(config);
  }

  // pollTransactionStatus repeatedly fetches the transaction status until it
  // reaches a terminal state, so server callers do not need to reimplement it.
  async pollTransactionStatus(
    params: PollTransactionStatusParams,
  ): Promise<TGetSendTransactionStatusResponse> {
    const {
      organizationId,
      sendTransactionStatusId,
      pollingIntervalMs,
      timeoutMs = 60_000,
    } = params;

    return new Promise((resolve, reject) => {
      const interval = pollingIntervalMs ?? 500;

      const ref = setInterval(async () => {
        try {
          const resp = await this.getSendTransactionStatus({
            sendTransactionStatusId,
            ...(organizationId ? { organizationId } : {}),
          });
          const txStatus = resp?.txStatus;

          if (!txStatus) {
            return;
          }

          if (txStatus === "FAILED" || txStatus === "CANCELLED") {
            clearInterval(ref);
            clearTimeout(timeoutRef);
            reject(
              new TurnkeyError(
                resp.error?.message || `Transaction ${resp.txStatus}`,
                TurnkeyErrorCodes.POLL_TRANSACTION_STATUS_ERROR,
                resp,
              ),
            );
            return;
          }

          if (txStatus === "COMPLETED" || txStatus === "INCLUDED") {
            clearInterval(ref);
            clearTimeout(timeoutRef);
            resolve(resp);
          }
        } catch (error) {
          clearInterval(ref);
          clearTimeout(timeoutRef);
          reject(error);
        }
      }, interval);

      const timeoutRef = setTimeout(() => {
        clearInterval(ref);
        reject(new Error(`Polling timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }
}
