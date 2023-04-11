import { PublicApiService } from "./__generated__/barrel";
import type { definitions } from "./__generated__/services/coordinator/public/v1/public_api.types";

const DEFAULT_REFRESH_INTERVAL_MS = 500;

type TActivity = definitions["v1Activity"];
type TActivityResponse = definitions["v1ActivityResponse"];
// type TActivityType = definitions["v1ActivityType"];
// type TActivityId = TActivity["id"];

/**
 * TODO: document this helper
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
          // TODO refine the output here
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
          // You can catch the error and use the error's TODO,
          throw new Error("TODO");
        }
        case "ACTIVITY_STATUS_FAILED": {
          // Activity failed
          throw new Error("TODO");
        }
        case "ACTIVITY_STATUS_REJECTED": {
          // Activity was rejected
          throw new Error("TODO");
        }
        default: {
          // Make sure the switch block is exhaustive
          assertNever(activity.status);
        }
      }

      await sleep(refreshIntervalMs);

      const pollingResponse: TActivityResponse =
        await PublicApiService.postGetActivity({
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
