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

import {
  TurnkeyServerSDK,
  TurnkeySDKServerClient
} from "./sdk-client";

import type {
  TurnkeySDKClientConfig,
  TurnkeySDKServerConfig
} from "./__types__/base";

// Classes
export {
  ApiKeyStamper,
  TurnkeyActivityError,
  TurnkeyServerSDK,
  TurnkeySDKServerClient,
  TurnkeyRequestError,
}

// Types
export type {
  TApiKeyStamperConfig,
  TSignedRequest,
  TurnkeyApiTypes,
  TurnkeySDKClientConfig,
  TurnkeySDKServerConfig
}

// Functions
export {
  createActivityPoller,
  getWebAuthnAttestation,
  sealAndStampRequestBody,
  signWithApiKey
}

// ???
export {
  TurnkeyApi,
}
