import { describe, expect, it, jest } from "@jest/globals";
import { type TActivityStatus, TurnkeyErrorCodes } from "@turnkey/sdk-types";

import { TurnkeyApiClient } from "../sdk-client";

function createClient(
  submitStatus: TActivityStatus,
  pollStatus: TActivityStatus,
) {
  const client = new TurnkeyApiClient({
    stamper: {
      stamp: async () => ({
        stampHeaderName: "X-Stamp",
        stampHeaderValue: "stamp",
      }),
    },
    apiBaseUrl: "https://mocked.turnkey.com",
    organizationId: "org-id",
  });

  client.submitExportSecrets = async () => ({
    activityId: "activity-id",
    fingerprint: "sha256:fingerprint",
    status: submitStatus,
  });
  const getActivity = jest.fn(async () => ({
    activity: {
      id: "activity-id",
      fingerprint: "sha256:fingerprint",
      status: pollStatus,
    },
  }));
  client.getActivity = getActivity as unknown as typeof client.getActivity;

  return { client, getActivity };
}

describe("exportSecret", () => {
  it("throws consensus needed as soon as polling sees it", async () => {
    const { client, getActivity } = createClient(
      "ACTIVITY_STATUS_PENDING",
      "ACTIVITY_STATUS_CONSENSUS_NEEDED",
    );

    await expect(
      client.exportSecret({ secretId: "secret-id", pollingIntervalMs: 10 }),
    ).rejects.toMatchObject({
      code: TurnkeyErrorCodes.EXPORT_SECRET_CONSENSUS_NEEDED,
    });
    expect(getActivity).toHaveBeenCalledTimes(1);
  });

  it("does not poll when submit returns a terminal status", async () => {
    const { client, getActivity } = createClient(
      "ACTIVITY_STATUS_FAILED",
      "ACTIVITY_STATUS_FAILED",
    );

    await expect(
      client.exportSecret({ secretId: "secret-id" }),
    ).rejects.toMatchObject({
      code: TurnkeyErrorCodes.EXPORT_SECRET_ERROR,
      message:
        "Secret export activity reached terminal status ACTIVITY_STATUS_FAILED",
    });
    expect(getActivity).not.toHaveBeenCalled();
  });
});
