import type { definitions } from "./__generated__/services/coordinator/public/v1/public_api.types";

export type TActivity = definitions["v1Activity"];
export type TActivityResponse = definitions["v1ActivityResponse"];
export type TActivityId = TActivity["id"];
export type TActivityStatus = TActivity["status"];
export type TActivityType = TActivity["type"];

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
