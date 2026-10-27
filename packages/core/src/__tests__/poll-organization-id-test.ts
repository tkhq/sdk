import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import { StamperType } from "../__types__";

const PARENT_ORG_ID = "parent-org-id";
const SUB_ORG_ID = "sub-org-id";
const SUBMIT_PATH = "/public/v1/submit/sign_raw_payload";

type RecordedRequest = { url: string; body: Record<string, unknown> };

// The submitted activity belongs to the sub-org and comes back in
// `submitStatus`; get_activity always returns it COMPLETED.
function stubFetch(submitStatus: string): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  const activity = {
    id: "activity-id",
    organizationId: SUB_ORG_ID,
    fingerprint: "fingerprint",
    type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
  };

  global.fetch = jest.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      requests.push({ url: path, body: JSON.parse(String(init?.body)) });

      let payload: unknown;
      if (path.endsWith("/query/get_mfa_status")) {
        payload = { mfaStatuses: [{ authenticatorId: "authenticator-id" }] };
      } else if (path.endsWith("/query/get_activity")) {
        payload = {
          activity: {
            ...activity,
            status: "ACTIVITY_STATUS_COMPLETED",
            result: {},
          },
        };
      } else {
        payload = { activity: { ...activity, status: submitStatus } };
      }

      return new Response(JSON.stringify(payload), { status: 200 });
    },
  ) as typeof fetch;

  return requests;
}

// No storageManager, so there is no active session to fall back to.
function createClient(onMfaRequired?: () => Promise<void>) {
  return new TurnkeySDKClientBase({
    apiBaseUrl: "https://api.example.com",
    organizationId: PARENT_ORG_ID,
    apiKeyStamper: {
      stamp: async () => ({
        stampHeaderName: "X-Stamp",
        stampHeaderValue: "stamp",
      }),
    },
    defaultStamperType: StamperType.ApiKey,
    activityPoller: { intervalMs: 0, numRetries: 3 },
    ...(onMfaRequired ? { onMfaRequired } : {}),
  });
}

function getActivityOrganizationIds(requests: RecordedRequest[]) {
  return requests
    .filter((r) => r.url.endsWith("/query/get_activity"))
    .map((r) => r.body.organizationId);
}

describe("pollForCompletion", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("polls the activity's organization when there is no active session", async () => {
    const requests = stubFetch("ACTIVITY_STATUS_PENDING");

    await createClient().activity(
      SUBMIT_PATH,
      { organizationId: SUB_ORG_ID, parameters: {} },
      "signRawPayloadResult",
    );

    expect(getActivityOrganizationIds(requests)).toEqual([SUB_ORG_ID]);
  });

  it("re-polls the activity's organization after onMfaRequired resolves", async () => {
    const requests = stubFetch("ACTIVITY_STATUS_AUTHENTICATORS_NEEDED");
    const onMfaRequired = jest.fn(async () => {});

    await createClient(onMfaRequired).activity(
      SUBMIT_PATH,
      { organizationId: SUB_ORG_ID, parameters: {} },
      "signRawPayloadResult",
    );

    expect(onMfaRequired).toHaveBeenCalledTimes(1);
    expect(getActivityOrganizationIds(requests)).toEqual([SUB_ORG_ID]);
  });
});
