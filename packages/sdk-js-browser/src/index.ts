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
  ApiKeyStamper,
  signWithApiKey,
  TApiKeyStamperConfig,
} from "@turnkey/api-key-stamper";

import {
  IframeEventType,
  IframeStamper,
  TIframeStamperConfig,
} from "@turnkey/iframe-stamper";

import {
  TWebauthnStamperConfig,
  WebauthnStamper,
} from "@turnkey/webauthn-stamper";

import { TurnkeyBrowserSDK, TurnkeySDKBrowserClient } from "./sdk-client";

import type {
  TurnkeySDKClientConfig,
  TurnkeySDKBrowserConfig,
} from "./__types__/base";

import type * as TurnkeySDKApiTypes from "./__generated__/sdk_api_types";

// Classes
export {
  ApiKeyStamper,
  IframeStamper,
  TurnkeyActivityError,
  TurnkeyBrowserSDK,
  TurnkeySDKBrowserClient,
  TurnkeyRequestError,
  WebauthnStamper,
};

// Types
export type {
  TApiKeyStamperConfig,
  TIframeStamperConfig,
  TSignedRequest,
  TurnkeyApiTypes,
  TurnkeySDKApiTypes,
  TurnkeySDKClientConfig,
  TurnkeySDKBrowserConfig,
  TWebauthnStamperConfig,
};

// Functions
export {
  createActivityPoller,
  getWebAuthnAttestation,
  sealAndStampRequestBody,
  signWithApiKey,
};

// Enums
export { IframeEventType };

// Base Turnkey API
export { TurnkeyApi };
