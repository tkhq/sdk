import { PublicApiService as TurnkeyApi } from "./__generated__/barrel";
export type { definitions as TurnkeyApiTypes } from "./__generated__/services/coordinator/public/v1/public_api.types";
export { TurnkeyClient } from "./__generated__/services/coordinator/public/v1/public_api.client";
export { init, browserInit } from "./config";

export { TurnkeyRequestError } from "./base";
export { TurnkeyActivityError } from "./shared";
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
