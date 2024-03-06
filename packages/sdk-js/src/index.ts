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
  IframeEventType,
  IframeStamper,
  TIframeStamperConfig
} from "@turnkey/iframe-stamper";

import {
  TWebauthnStamperConfig,
  WebauthnStamper
} from "@turnkey/webauthn-stamper";

import {
  TurnkeySDKClient
} from "./sdk-client";

import type {
  TurnkeySDKClientConfig
} from "./__types__/base";

// Classes
export {
  ApiKeyStamper,
  IframeStamper,
  TurnkeyActivityError,
  TurnkeySDKClient as TurnkeyClient,
  TurnkeyRequestError,
  WebauthnStamper
}

// Types
export type {
  TApiKeyStamperConfig,
  TIframeStamperConfig,
  TSignedRequest,
  TurnkeyApiTypes,
  TurnkeySDKClientConfig,
  TWebauthnStamperConfig
}

// Functions
export {
  createActivityPoller,
  getWebAuthnAttestation,
  sealAndStampRequestBody,
  signWithApiKey
}

// Enums
export {
  IframeEventType
}

// ???
export {
  TurnkeyApi,
}
