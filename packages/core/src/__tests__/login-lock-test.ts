import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@polyfills/window", () => ({ __esModule: true, default: {} }), {
  virtual: true,
});
jest.mock("@utils", () => ({}), { virtual: true });

import { TurnkeyClient } from "../__clients__/core";
import { AuthAction, type TStampLoginResponse } from "@turnkey/sdk-types";
import { OtpType } from "../__types__";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function verificationToken(publicKey: string) {
  return `header.${Buffer.from(JSON.stringify({ public_key: publicKey })).toString("base64")}.signature`;
}

function sessionResponse(session: string): TStampLoginResponse {
  return {
    session,
    activity: {
      id: "activity-id",
      organizationId: "org-id",
      status: "ACTIVITY_STATUS_COMPLETED",
      type: "ACTIVITY_TYPE_STAMP_LOGIN",
      intent: {},
      result: {},
      votes: [],
      fingerprint: "fingerprint",
      canApprove: false,
      canReject: false,
      createdAt: { seconds: "0", nanos: "0" },
      updatedAt: { seconds: "0", nanos: "0" },
    },
  };
}

function setup() {
  const client = new TurnkeyClient({ organizationId: "org-id" });
  client.httpClient = client.createHttpClient();
  const events: string[] = [];
  jest
    .spyOn(client, "overrideAttestedStamper")
    .mockImplementation(async ({ publicKey }) => {
      events.push(`override:${publicKey}`);
    });
  const stamp = jest
    .spyOn(client.httpClient, "stampLogin")
    .mockImplementation(async ({ publicKey }) => {
      events.push(`stamp:${publicKey}`);
      return sessionResponse(publicKey);
    });
  const store = jest
    .spyOn(client, "storeSession")
    .mockImplementation(async ({ sessionToken }) => {
      events.push(`store:${sessionToken}`);
    });
  jest.spyOn(client, "deleteApiKeyPair").mockResolvedValue(undefined);
  const login = (publicKey: string) =>
    client.loginWithOauth({ oidcToken: "oidc", publicKey });
  return { client, events, stamp, store, login };
}

const loginEvents = (key: string) => [
  `override:${key}`,
  `stamp:${key}`,
  `store:${key}`,
];

describe("client login lock", () => {
  it("queues mixed logins through stamping and session storage", async () => {
    const { client, events, stamp, store, login } = setup();
    const stamping = deferred();
    const stamped = deferred();
    const storing = deferred();
    const stored = deferred();
    stamp.mockImplementationOnce(async () => {
      events.push("stamp:first");
      stamping.resolve();
      await stamped.promise;
      return sessionResponse("first");
    });
    store.mockImplementationOnce(async () => {
      events.push("store:first");
      storing.resolve();
      await stored.promise;
    });

    const first = login("first");
    const second = client.loginWithOtp({
      verificationToken: verificationToken("second"),
    });
    await stamping.promise;
    expect(events).toEqual(["override:first", "stamp:first"]);
    stamped.resolve();
    await storing.promise;
    expect(events).toEqual(loginEvents("first"));
    stored.resolve();
    await Promise.all([first, second]);
    expect(events).toEqual([...loginEvents("first"), ...loginEvents("second")]);
  });

  it("releases the lock after a failed login, including cleanup", async () => {
    const { client, events, stamp, login } = setup();
    const cleaning = deferred();
    const cleaned = deferred();
    stamp.mockRejectedValueOnce(new Error("login rejected"));
    jest.spyOn(client, "deleteApiKeyPair").mockImplementationOnce(async () => {
      cleaning.resolve();
      await cleaned.promise;
    });
    const first = expect(login("first")).rejects.toThrow(
      "Failed to complete OAuth login",
    );
    const second = login("second");
    await cleaning.promise;
    expect(events).toEqual(["override:first"]);
    cleaned.resolve();
    await first;
    await expect(second).resolves.toEqual({ sessionToken: "second" });
    expect(events).toEqual(["override:first", ...loginEvents("second")]);
    await expect(login("third")).resolves.toEqual({ sessionToken: "third" });
  });

  it.each<[string, boolean]>([
    ["OAuth", true],
    ["OAuth", false],
    ["OTP", true],
    ["OTP", false],
  ])(
    "completes nested %s flows (existing account: %s) without deadlock",
    async (flow, existing) => {
      const { client, events, login } = setup();
      jest
        .spyOn(client.httpClient, "proxyGetAccount")
        .mockResolvedValue({ organizationId: existing ? "org-id" : "" });
      jest
        .spyOn(client.httpClient, "proxySignupV2")
        .mockResolvedValue({ organizationId: "org-id", userId: "user-id" });
      jest.spyOn(client, "signWithApiKey").mockResolvedValue("signature");
      jest.spyOn(client, "verifyOtp").mockResolvedValue({
        verificationToken: verificationToken("nested"),
        publicKey: "nested",
      });
      const nested =
        flow === "OAuth"
          ? client.completeOauth({ oidcToken: "oidc", publicKey: "nested" })
          : client.completeOtp({
              otpId: "otp",
              otpCode: "123456",
              otpEncryptionTargetBundle: "bundle",
              contact: "test@example.com",
              otpType: OtpType.Email,
              publicKey: "nested",
            });

      const [result] = await Promise.all([nested, login("next")]);
      expect(result).toMatchObject({
        sessionToken: "nested",
        action: existing ? AuthAction.LOGIN : AuthAction.SIGNUP,
      });
      expect(events).toEqual([
        ...loginEvents("nested"),
        ...loginEvents("next"),
      ]);
    },
  );
});
