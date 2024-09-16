import { PublicApiService as TurnkeyApi } from "./__generated__/barrel";
export type { definitions as TurnkeyApiTypes } from "./__generated__/services/coordinator/public/v1/public_api.types";
export { TurnkeyClient } from "./__generated__/services/coordinator/public/v1/public_api.client";

export { init, browserInit } from "./config";
export { TurnkeyRequestError } from "./base";
export {
  assertNonNull,
  assertActivityCompleted,
  getSignatureFromActivity,
  getSignaturesFromActivity,
  getSignedTransactionFromActivity,
  InvalidArgumentError,
  TurnkeyActivityError,
  TurnkeyActivityConsensusNeededError,
  type TActivity,
  type TActivityId,
  type TActivityResponse,
  type TActivityStatus,
  type TActivityType,
  type TSignature,
  TERMINAL_ACTIVITY_STATUSES,
} from "./shared";
export type { SignedRequest, TSignedRequest } from "./base";
export { getWebAuthnAttestation } from "./webauthn";
export { withAsyncPolling, createActivityPoller } from "./async";

export { TurnkeyApi };

/**
 * @deprecated use `TurnkeyApi` instead
 */
const PublicApiService = TurnkeyApi;

export { PublicApiService };

export { sealAndStampRequestBody } from "./base";

export { VERSION } from "./version";
