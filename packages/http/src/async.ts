import { PublicApiService as TurnkeyApi } from "./__generated__/barrel";
import { TActivity, TActivityResponse, TurnkeyActivityError } from "./shared";

const DEFAULT_REFRESH_INTERVAL_MS = 500;

/**
 * Wraps a request to create a fetcher with built-in async polling support.
 *
 * {@link https://github.com/tkhq/sdk/blob/main/packages/http/README.md#withasyncpolling-helper}
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

      const pollingResponse: TActivityResponse =
        await TurnkeyApi.getActivity({
          body: {
            activityId: activity.id,
            organizationId: activity.organizationId,
          },
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
