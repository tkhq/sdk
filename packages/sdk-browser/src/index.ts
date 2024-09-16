import {
  createActivityPoller,
  getWebAuthnAttestation,
  sealAndStampRequestBody,
  TurnkeyActivityError,
  TurnkeyApi,
  TurnkeyRequestError,
  type TSignedRequest,
  type TActivity,
  type TurnkeyApiTypes,
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

import {
  TurnkeyBrowserSDK,
  TurnkeyBrowserClient,
  TurnkeyIframeClient,
  TurnkeyPasskeyClient,
} from "./sdk-client";

import {
  defaultEthereumAccountAtIndex,
  DEFAULT_ETHEREUM_ACCOUNTS,
  defaultSolanaAccountAtIndex,
  DEFAULT_SOLANA_ACCOUNTS,
} from "./turnkey-helpers";

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
  TurnkeyBrowserSDK as Turnkey,
  TurnkeyBrowserClient,
  TurnkeyIframeClient,
  TurnkeyPasskeyClient,
  TurnkeyRequestError,
  WebauthnStamper,
};

// Types
export type {
  TActivity,
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
  defaultEthereumAccountAtIndex,
  defaultSolanaAccountAtIndex,
  getWebAuthnAttestation,
  sealAndStampRequestBody,
  signWithApiKey,
};

// Constants
export { DEFAULT_ETHEREUM_ACCOUNTS, DEFAULT_SOLANA_ACCOUNTS };

// Enums
export { IframeEventType };

// Base Turnkey API
export { TurnkeyApi };
