import {
  ApiKeyStamper,
  signWithApiKey,
  TApiKeyStamperConfig,
} from "@turnkey/api-key-stamper";

import {
  createActivityPoller,
  getWebAuthnAttestation,
  sealAndStampRequestBody,
  TSignedRequest,
  TurnkeyActivityError,
  TurnkeyApi,
  TurnkeyApiTypes,
  TurnkeyRequestError,
} from "@turnkey/http";

import { TurnkeyServerSDK, TurnkeySDKServerClient } from "./sdk-client";

import type {
  TurnkeySDKClientConfig,
  TurnkeySDKServerConfig,
  TurnkeyProxyHandlerConfig,
} from "./__types__/base";

import type * as TurnkeySDKApiTypes from "./__generated__/sdk_api_types";

// Classes
export {
  ApiKeyStamper,
  TurnkeyActivityError,
  TurnkeyServerSDK,
  TurnkeySDKServerClient,
  TurnkeyRequestError,
};

// Types
export type {
  TApiKeyStamperConfig,
  TSignedRequest,
  TurnkeyApiTypes,
  TurnkeySDKApiTypes,
  TurnkeySDKClientConfig,
  TurnkeySDKServerConfig,
  TurnkeyProxyHandlerConfig,
};

// Functions
export {
  createActivityPoller,
  getWebAuthnAttestation,
  sealAndStampRequestBody,
  signWithApiKey,
};

// Base Turnkey API
export { TurnkeyApi };
