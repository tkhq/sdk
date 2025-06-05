// marked as internal to prevent inclusion in the http docs
/** @internal */
import { PublicApiService as TurnkeyApi } from "./__generated__/barrel";

// marked as internal to prevent inclusion in the http docs
/** @internal */
export type { definitions as TurnkeyApiTypes } from "./__generated__/services/coordinator/public/v1/public_api.types";

// marked as internal to prevent inclusion in the http docs
/** @internal */
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

export { sealAndStampRequestBody, isHttpClient } from "./base";

export { VERSION } from "./version";
