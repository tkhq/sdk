import type { definitions } from "./__generated__/services/coordinator/public/v1/public_api.types";

export type TActivity = definitions["v1Activity"];
export type TActivityResponse = definitions["v1ActivityResponse"];
export type TActivityId = TActivity["id"];
export type TActivityStatus = TActivity["status"];
export type TActivityType = TActivity["type"];
export type TSignature = definitions["v1SignRawPayloadResult"];
export type TSignedTransaction =
  definitions["v1SignTransactionResult"]["signedTransaction"];

export class TurnkeyActivityError extends Error {
  activityId: TActivityId | undefined;
  activityStatus: TActivityStatus | undefined;
  activityType: TActivityType | undefined;
  cause: Error | undefined;

  constructor(input: {
    message: string;
    cause?: Error | undefined;
    activityId?: TActivityId | undefined;
    activityStatus?: TActivityStatus | undefined;
    activityType?: TActivityType | undefined;
  }) {
    const { message, cause, activityId, activityStatus, activityType } = input;
    super(message);

    this.name = "TurnkeyActivityError";
    this.activityId = activityId ?? undefined;
    this.activityStatus = activityStatus ?? undefined;
    this.activityType = activityType ?? undefined;
    this.cause = cause ?? undefined;
  }
}

export class TurnkeyActivityConsensusNeededError extends Error {
  activityId: TActivityId | undefined;
  activityStatus: TActivityStatus | undefined;
  activityType: TActivityType | undefined;
  cause: Error | undefined;

  constructor(input: {
    message: string;
    cause?: Error | undefined;
    activityId?: TActivityId | undefined;
    activityStatus?: TActivityStatus | undefined;
    activityType?: TActivityType | undefined;
  }) {
    const { message, cause, activityId, activityStatus, activityType } = input;
    super(message);

    this.name = "TurnkeyActivityConsensusNeededError";
    this.activityId = activityId ?? undefined;
    this.activityStatus = activityStatus ?? undefined;
    this.activityType = activityType ?? undefined;
    this.cause = cause ?? undefined;
  }
}

export function checkActivityStatus(input: {
  id: string;
  status: TActivityStatus;
}) {
  const { id: activityId, status: activityStatus } = input;

  if (activityStatus === "ACTIVITY_STATUS_CONSENSUS_NEEDED") {
    throw new TurnkeyActivityConsensusNeededError({
      message: "Activity requires consensus",
      activityId,
      activityStatus,
    });
  }

  if (activityStatus !== "ACTIVITY_STATUS_COMPLETED") {
    throw new TurnkeyActivityError({
      message: `Expected COMPLETED status, got ${activityStatus}`,
      activityId,
      activityStatus,
    });
  }

  return true;
}

export function stableStringify(input: Record<string, any>): string {
  return JSON.stringify(input);
}

export function assertNonNull<T>(input: T | null | undefined): T {
  if (input == null) {
    throw new Error(`Got unexpected ${JSON.stringify(input)}`);
  }

  return input;
}

export const TERMINAL_ACTIVITY_STATUSES: definitions["v1ActivityStatus"][] = [
  "ACTIVITY_STATUS_COMPLETED",
  "ACTIVITY_STATUS_FAILED",
  "ACTIVITY_STATUS_REJECTED",
];

/**
 * This function is a helper method to easily extract a signature string from a completed signing activity.
 * Particularly useful for scenarios where a signature requires consensus
 *
 * @param activity the signing activity
 * @return signature {r, s, v}
 */
export function getSignatureFromActivity(activity: TActivity): TSignature {
  if (
    ![
      "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD",
      "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
    ].includes(activity.type)
  ) {
    throw new TurnkeyActivityError({
      message: `Unexpected activity type: ${activity.type}`,
      activityId: activity.id,
      activityStatus: activity.status,
    });
  }

  checkActivityStatus({
    id: activity.id,
    status: activity.status,
  });

  const signature = activity.result?.signRawPayloadResult!;

  return assertNonNull(signature);
}

/**
 * This function is a helper method to easily extract signature strings from a completed signing activity.
 * Particularly useful for scenarios where a signature requires consensus
 *
 * @param activity the signing activity
 * @return signatures {r, s, v}[]
 */
export function getSignaturesFromActivity(activity: TActivity): TSignature[] {
  if (!["ACTIVITY_TYPE_SIGN_RAW_PAYLOADS"].includes(activity.type)) {
    throw new TurnkeyActivityError({
      message: `Unexpected activity type: ${activity.type}`,
      activityId: activity.id,
      activityStatus: activity.status,
    });
  }

  checkActivityStatus({
    id: activity.id,
    status: activity.status,
  });

  const { signatures } = activity.result?.signRawPayloadsResult!;

  return assertNonNull(signatures);
}

/**
 * This function is a helper method to easily extract a signed transaction from a completed signing activity.
 * Particularly useful for scenarios where a signature requires consensus
 *
 * @param activity the signing activity
 * @return signed transaction string
 */
export function getSignedTransactionFromActivity(
  activity: TActivity
): TSignedTransaction {
  if (
    ![
      "ACTIVITY_TYPE_SIGN_TRANSACTION",
      "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
    ].includes(activity.type)
  ) {
    throw new TurnkeyActivityError({
      message: `Unexpected activity type: ${activity.type}`,
      activityId: activity.id,
      activityStatus: activity.status,
    });
  }

  checkActivityStatus({
    id: activity.id,
    status: activity.status,
  });

  const { signedTransaction } = activity.result?.signTransactionResult!;

  return assertNonNull(`0x${signedTransaction}`);
}
