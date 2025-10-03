import {
  v1ActivityResponse,
  v1ActivityStatus,
  v1AuthenticatorParamsV2,
} from "@turnkey/sdk-types";
import { TStamp } from "./auth";

/** @internal */
export type TActivityStatus = v1ActivityStatus;
/** @internal */
export type TActivityResponse = v1ActivityResponse;

/** @internal */
export type TSignedRequest = {
  body: string;
  stamp: TStamp;
  url: string;
};

/** @internal */
export const TERMINAL_ACTIVITY_STATUSES: TActivityStatus[] = [
  "ACTIVITY_STATUS_COMPLETED",
  "ACTIVITY_STATUS_FAILED",
  "ACTIVITY_STATUS_REJECTED",
];

/** @internal */
export type TurnkeyAuthenticatorParams = v1AuthenticatorParamsV2;
