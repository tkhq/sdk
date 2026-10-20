import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import { StamperType } from "../__types__";

const PARENT = "parent-org-id";
const SUB_ORG = "sub-org-id";
const API_BASE_URL = "https://api.example.com";

type FetchCall = { url: string; body: string };

/**
 * Stub `global.fetch` and record every request. Responses are chosen by URL:
 * the submit path returns `submitStatus` (scoped to SUB_ORG), get_mfa_status
 * returns a single MFA status, and get_activity returns COMPLETED. Returns the
 * recorded calls so tests can assert on the polled request bodies.
 */
function stubFetch(submitStatus: string) {
  const calls: FetchCall[] = [];
  const activity = {
    id: "activity-1",
    organizationId: SUB_ORG,
    fingerprint: "fingerprint-1",
    type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
  };

  const fetchMock = jest.fn(async (url: unknown, init: unknown) => {
    const u = String(url);
    calls.push({ url: u, body: String((init as { body: string }).body) });

    let payload: unknown;
    if (u.includes("/query/get_mfa_status")) {
      payload = { mfaStatuses: [{ authenticatorId: "auth-1" }] };
    } else if (u.includes("/query/get_activity")) {
      payload = { activity: { ...activity, status: "ACTIVITY_STATUS_COMPLETED", result: {} } };
    } else {
      payload = { activity: { ...activity, status: submitStatus } };
    }

    return { ok: true, status: 200, json: async () => payload };
  });

  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  return { calls };
}

function createClient(extra: Record<string, unknown> = {}) {
  const stamp = jest.fn(async () => ({
    stampHeaderName: "X-Stamp",
    stampHeaderValue: "stamp",
  }));
  // No storageManager => getActiveSession() is undefined (the no-session case).
  const client = new TurnkeySDKClientBase({
    apiBaseUrl: API_BASE_URL,
    organizationId: PARENT,
    apiKeyStamper: { stamp },
    defaultStamperType: StamperType.ApiKey,
    activityPoller: { intervalMs: 0, numRetries: 3 },
    ...extra,
  });
  return client;
}

function getActivityBody(calls: FetchCall[]) {
  const call = calls.find((c) => c.url.includes("/query/get_activity"));
  expect(call).toBeDefined();
  return JSON.parse(call!.body);
}

describe("pollForCompletion threads the activity's organizationId", () => {
  afterEach(() => {
    delete (global as unknown as { fetch?: unknown }).fetch;
    jest.restoreAllMocks();
  });

  it("polls get_activity against the sub-org when submitting with no active session", async () => {
    const { calls } = stubFetch("ACTIVITY_STATUS_PENDING");
    const client = createClient();

    await client.activity(
      "/public/v1/submit/sign_raw_payload",
      { organizationId: SUB_ORG, parameters: {} },
      "signRawPayloadResult",
    );

    // Before the fix this fell back to config.organizationId (PARENT).
    expect(getActivityBody(calls).organizationId).toBe(SUB_ORG);
  });

  it("polls get_activity against the sub-org on the post-MFA re-poll", async () => {
    const onMfaRequired = jest.fn(async () => {});
    const { calls } = stubFetch("ACTIVITY_STATUS_AUTHENTICATORS_NEEDED");
    const client = createClient({ onMfaRequired });

    await client.activity(
      "/public/v1/submit/sign_raw_payload",
      { organizationId: SUB_ORG, parameters: {} },
      "signRawPayloadResult",
    );

    expect(onMfaRequired).toHaveBeenCalledTimes(1);
    expect(getActivityBody(calls).organizationId).toBe(SUB_ORG);
  });
});
