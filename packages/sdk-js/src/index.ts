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
  TurnkeyServerRoot,
  TurnkeyClientRoot,
  TurnkeyLocalClient,
  TurnkeySDKBrowserClient,
  TurnkeySDKServerClient,
  TurnkeySDKClient,
} from "./sdk-client";

import type {
  TurnkeySDKClientConfig,
  TurnkeyServerSDKConfig,
  TurnkeyClientSDKConfig
} from "./__types__/base";

// Classes
export {
  ApiKeyStamper,
  IframeStamper,
  TurnkeyActivityError,
  TurnkeyLocalClient,
  TurnkeyServerRoot,
  TurnkeyClientRoot,
  TurnkeySDKBrowserClient,
  TurnkeySDKServerClient,
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
  TurnkeyServerSDKConfig,
  TurnkeyClientSDKConfig,
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
