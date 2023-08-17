import type { TurnkeyClient } from ".";
import { PublicApiService as TurnkeyApi } from "./__generated__/barrel";
import { TActivity, TActivityResponse, TurnkeyActivityError } from "./shared";

const DEFAULT_REFRESH_INTERVAL_MS = 500;

/**
 * Wraps a request to create a fetcher with built-in async polling support.
 *
 * @deprecated this function only works with {@link TurnkeyApi}.
 * Use {@link TurnkeyClient} and {@link createActivityPoller} instead.
 */
export function withAsyncPolling<
  O extends TActivityResponse,
  I extends { body: unknown }
>(params: {
  request: (input: I) => Promise<O>;
  refreshIntervalMs?: number;
}): (input: I) => Promise<O["activity"]> {
  const { request, refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS } = params;

  return async (input: I) => {
    const initialResponse: TActivityResponse = await request(input);
    let activity: TActivity = initialResponse.activity;

    while (true) {
      switch (activity.status) {
        case "ACTIVITY_STATUS_COMPLETED": {
          return activity;
        }
        case "ACTIVITY_STATUS_CREATED": {
          // Async pending state -- keep polling
          break;
        }
        case "ACTIVITY_STATUS_PENDING": {
          // Async pending state -- keep polling
          break;
        }
        case "ACTIVITY_STATUS_CONSENSUS_NEEDED": {
          // If the activity requires consensus, we shouldn't be polling forever.
          // You can read the `TurnkeyActivityError` thrown to get the `activityId`,
          // store it somewhere, then re-fetch the activity via `.postGetActivity(...)`
          // when the required approvals/rejections are in place.
          throw new TurnkeyActivityError({
            message: `Consensus needed for activity ${activity.id}`,
            activityId: activity.id,
            activityStatus: activity.status,
            activityType: activity.type,
          });
        }
        case "ACTIVITY_STATUS_FAILED": {
          // Activity failed
          throw new TurnkeyActivityError({
            message: `Activity ${activity.id} failed`,
            activityId: activity.id,
            activityStatus: activity.status,
            activityType: activity.type,
          });
        }
        case "ACTIVITY_STATUS_REJECTED": {
          // Activity was rejected
          throw new TurnkeyActivityError({
            message: `Activity ${activity.id} was rejected`,
            activityId: activity.id,
            activityStatus: activity.status,
            activityType: activity.type,
          });
        }
        default: {
          // Make sure the switch block is exhaustive
          assertNever(activity.status);
        }
      }

      await sleep(refreshIntervalMs);

      const pollingResponse: TActivityResponse = await TurnkeyApi.getActivity({
        body: {
          activityId: activity.id,
          organizationId: activity.organizationId,
        },
      });

      activity = pollingResponse.activity;
    }
  };
}

/**
 * Wraps a client request function (e.g. `client.createPrivateKeys`) in a poller.
 * The default refresh interval is 500ms.
 *
 * The returned poller will poll until the activity becomes `COMPLETED`.
 * If the activity becomes `FAILED` or `REJECTED` or is flagged as `NEEDS_CONSENSUS`, an error is thrown.
 *
 * @example
 * const activityPoller = createActivityPoller(client, client.createPrivateKeys);
 * const activity = await activityPoller(input);
 * console.log(activity.result); // activity is completed
 */
export function createActivityPoller<
  O extends TActivityResponse,
  I extends {}
>(params: {
  client: TurnkeyClient;
  requestFn: (input: I) => Promise<O>;
  refreshIntervalMs?: number;
}): (input: I) => Promise<O["activity"]> {
  const {
    client,
    requestFn,
    refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
  } = params;

  return async (input: I) => {
    const initialResponse: TActivityResponse = await requestFn(input);
    let activity: TActivity = initialResponse.activity;

    while (true) {
      switch (activity.status) {
        case "ACTIVITY_STATUS_COMPLETED": {
          return activity;
        }
        case "ACTIVITY_STATUS_CREATED": {
          // Async pending state -- keep polling
          break;
        }
        case "ACTIVITY_STATUS_PENDING": {
          // Async pending state -- keep polling
          break;
        }
        case "ACTIVITY_STATUS_CONSENSUS_NEEDED": {
          // If the activity requires consensus, we shouldn't be polling forever.
          // You can read the `TurnkeyActivityError` thrown to get the `activityId`,
          // store it somewhere, then re-fetch the activity via `.postGetActivity(...)`
          // when the required approvals/rejections are in place.
          throw new TurnkeyActivityError({
            message: `Consensus needed for activity ${activity.id}`,
            activityId: activity.id,
            activityStatus: activity.status,
            activityType: activity.type,
          });
        }
        case "ACTIVITY_STATUS_FAILED": {
          // Activity failed
          throw new TurnkeyActivityError({
            message: `Activity ${activity.id} failed`,
            activityId: activity.id,
            activityStatus: activity.status,
            activityType: activity.type,
          });
        }
        case "ACTIVITY_STATUS_REJECTED": {
          // Activity was rejected
          throw new TurnkeyActivityError({
            message: `Activity ${activity.id} was rejected`,
            activityId: activity.id,
            activityStatus: activity.status,
            activityType: activity.type,
          });
        }
        default: {
          // Make sure the switch block is exhaustive
          assertNever(activity.status);
        }
      }

      await sleep(refreshIntervalMs);

      const pollingResponse: TActivityResponse = await client.getActivity({
        activityId: activity.id,
        organizationId: activity.organizationId,
      });

      activity = pollingResponse.activity;
    }
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

function assertNever(input: never, message?: string): never {
  throw new Error(
    message != null ? message : `Unexpected case: ${JSON.stringify(input)}`
  );
}
