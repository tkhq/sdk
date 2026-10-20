import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

jest.mock(
  "@polyfills/window",
  () => ({
    __esModule: true,
    default: {
      localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
    },
  }),
  { virtual: true },
);
jest.mock(
  "@utils",
  () => ({
    __esModule: true,
    parseSession: jest.fn(),
  }),
  { virtual: true },
);

import { TurnkeyClient } from "../__clients__/core";
import { TurnkeySDKClientBase } from "../__generated__/sdk-client-base";
import { AttestedScheme, AttestedStamper } from "../__stampers__/attested/base";

const API_BASE_URL = "https://api.test";
const FAILING_PUBLIC_KEY = "failing-key";

type RecordedRequest = {
  url: string;
  body: any;
  stamp: {
    publicKeyAttestation: string;
    scheme: AttestedScheme;
    publicKey: string;
    signature: string;
  };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function verificationTokenFor(publicKey: string): string {
  const payload = Buffer.from(
    JSON.stringify({ id: `token-${publicKey}`, public_key: publicKey }),
  ).toString("base64");
  return `header.${payload}.signature`;
}

function oidcTokenFor(publicKey: string): string {
  return `oidc-${publicKey}`;
}

// Fake signer: the signature names the key that signed, and keys listed in
// `signDelays` take longer to sign so that concurrent logins interleave.
function createFakeSigner(signDelays: Record<string, number>) {
  return {
    sign: jest.fn(
      async (_payload: string, _format: unknown, publicKey: string) => {
        await sleep(signDelays[publicKey] ?? 0);
        return `sig:${publicKey}`;
      },
    ),
  };
}

function decodeStamp(headerValue: string): RecordedRequest["stamp"] {
  return JSON.parse(Buffer.from(headerValue, "base64url").toString("utf8"));
}

// Mocked fetch: records each stamped request. stamp_login returns a pending
// activity, so every login also polls get_activity with the attested stamper.
function installFetchMock(): RecordedRequest[] {
  const requests: RecordedRequest[] = [];

  global.fetch = jest.fn(async (url: any, init: any) => {
    const body = JSON.parse(init.body);
    requests.push({
      url: String(url),
      body,
      stamp: decodeStamp(init.headers["X-Stamp-Attested"]),
    });

    const json = (data: unknown, ok = true) =>
      ({ ok, status: ok ? 200 : 500, json: async () => data }) as Response;

    if (String(url).endsWith("/public/v1/submit/stamp_login")) {
      const publicKey = body.parameters.publicKey;
      if (publicKey === FAILING_PUBLIC_KEY) {
        return json(
          { code: 13, message: "login rejected", details: [] },
          false,
        );
      }
      return json({
        activity: {
          id: `activity-${publicKey}`,
          organizationId: body.organizationId,
          status: "ACTIVITY_STATUS_PENDING",
          type: "ACTIVITY_TYPE_STAMP_LOGIN",
        },
      });
    }

    if (String(url).endsWith("/public/v1/query/get_activity")) {
      const publicKey = body.activityId.replace(/^activity-/, "");
      return json({
        activity: {
          id: body.activityId,
          organizationId: body.organizationId,
          status: "ACTIVITY_STATUS_COMPLETED",
          type: "ACTIVITY_TYPE_STAMP_LOGIN",
          result: { stampLoginResult: { session: `session-${publicKey}` } },
        },
      });
    }

    throw new Error(`unexpected request to ${url}`);
  }) as unknown as typeof fetch;

  return requests;
}

function createClient(signDelays: Record<string, number> = {}): TurnkeyClient {
  const signer = createFakeSigner(signDelays);
  const attestedStamper = new AttestedStamper(signer as any);

  const client = new TurnkeyClient({
    organizationId: "org-id",
    apiBaseUrl: API_BASE_URL,
  });

  (client as any).attestedStamper = attestedStamper;
  (client as any).httpClient = new TurnkeySDKClientBase({
    apiBaseUrl: API_BASE_URL,
    organizationId: "org-id",
    attestedStamper,
    activityPoller: { intervalMs: 5, numRetries: 3 },
  });
  (client as any).storeSession = jest.fn(async () => {});
  (client as any).deleteApiKeyPair = jest.fn(async () => {});

  return client;
}

// Every request must be stamped with the identity of the principal it is for:
// the stamp's public key matches the key in the body (or the activity being
// polled), and the attestation and signature belong to that same key.
function expectRequestsBoundToOwnPrincipal(
  requests: RecordedRequest[],
  identities: Record<string, { attestation: string; scheme: AttestedScheme }>,
) {
  expect(requests.length).toBeGreaterThan(0);
  for (const { url, body, stamp } of requests) {
    const publicKey = url.endsWith("/stamp_login")
      ? body.parameters.publicKey
      : body.activityId.replace(/^activity-/, "");

    expect(stamp.publicKey).toBe(publicKey);
    expect(stamp.publicKeyAttestation).toBe(identities[publicKey]!.attestation);
    expect(stamp.scheme).toBe(identities[publicKey]!.scheme);
    expect(stamp.signature).toBe(`sig:${publicKey}`);
  }
}

const otpIdentity = (publicKey: string) => ({
  attestation: verificationTokenFor(publicKey),
  scheme: AttestedScheme.P256_VERIFICATION_TOKEN,
});

const oauthIdentity = (publicKey: string) => ({
  attestation: oidcTokenFor(publicKey),
  scheme: AttestedScheme.P256_OIDC,
});

describe("attested stamper concurrency", () => {
  const originalFetch = global.fetch;
  let requests: RecordedRequest[];

  beforeEach(() => {
    requests = installFetchMock();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("binds each session to its own principal for concurrent OTP logins", async () => {
    const client = createClient({ "key-a": 30 });

    const [a, b] = await Promise.all([
      client.loginWithOtp({ verificationToken: verificationTokenFor("key-a") }),
      client.loginWithOtp({ verificationToken: verificationTokenFor("key-b") }),
    ]);

    expect(a.sessionToken).toBe("session-key-a");
    expect(b.sessionToken).toBe("session-key-b");
    expectRequestsBoundToOwnPrincipal(requests, {
      "key-a": otpIdentity("key-a"),
      "key-b": otpIdentity("key-b"),
    });
  });

  it("binds each session to its own principal for concurrent OTP and OAuth logins", async () => {
    const client = createClient({ "key-a": 30 });

    const [a, b] = await Promise.all([
      client.loginWithOtp({ verificationToken: verificationTokenFor("key-a") }),
      client.loginWithOauth({
        oidcToken: oidcTokenFor("key-b"),
        publicKey: "key-b",
      }),
    ]);

    expect(a.sessionToken).toBe("session-key-a");
    expect(b.sessionToken).toBe("session-key-b");
    expectRequestsBoundToOwnPrincipal(requests, {
      "key-a": otpIdentity("key-a"),
      "key-b": oauthIdentity("key-b"),
    });
  });

  it("binds each session to its own principal for concurrent OAuth logins", async () => {
    const client = createClient({ "key-a": 30 });

    const [a, b] = await Promise.all([
      client.loginWithOauth({
        oidcToken: oidcTokenFor("key-a"),
        publicKey: "key-a",
      }),
      client.loginWithOauth({
        oidcToken: oidcTokenFor("key-b"),
        publicKey: "key-b",
      }),
    ]);

    expect(a.sessionToken).toBe("session-key-a");
    expect(b.sessionToken).toBe("session-key-b");
    expectRequestsBoundToOwnPrincipal(requests, {
      "key-a": oauthIdentity("key-a"),
      "key-b": oauthIdentity("key-b"),
    });
  });

  it("binds each session to its own principal for sequential logins", async () => {
    const client = createClient({ "key-a": 30 });

    const a = await client.loginWithOtp({
      verificationToken: verificationTokenFor("key-a"),
    });
    const b = await client.loginWithOauth({
      oidcToken: oidcTokenFor("key-b"),
      publicKey: "key-b",
    });

    expect(a.sessionToken).toBe("session-key-a");
    expect(b.sessionToken).toBe("session-key-b");
    expectRequestsBoundToOwnPrincipal(requests, {
      "key-a": otpIdentity("key-a"),
      "key-b": oauthIdentity("key-b"),
    });
  });

  it("lets the next login run after a login fails", async () => {
    const client = createClient({ [FAILING_PUBLIC_KEY]: 30 });

    const [failed, b] = await Promise.allSettled([
      client.loginWithOtp({
        verificationToken: verificationTokenFor(FAILING_PUBLIC_KEY),
      }),
      client.loginWithOtp({ verificationToken: verificationTokenFor("key-b") }),
    ]);
    const c = await client.loginWithOauth({
      oidcToken: oidcTokenFor("key-c"),
      publicKey: "key-c",
    });

    expect(failed.status).toBe("rejected");
    expect(b).toEqual({
      status: "fulfilled",
      value: { sessionToken: "session-key-b" },
    });
    expect(c.sessionToken).toBe("session-key-c");
    expectRequestsBoundToOwnPrincipal(requests, {
      [FAILING_PUBLIC_KEY]: otpIdentity(FAILING_PUBLIC_KEY),
      "key-b": otpIdentity("key-b"),
      "key-c": oauthIdentity("key-c"),
    });
  }, 5000);

  it("builds the stamp from the config present when stamp() was called", async () => {
    const stamper = new AttestedStamper(
      createFakeSigner({ "key-a": 30 }) as any,
    );
    stamper.configure({
      attestedIdentity: oidcTokenFor("key-a"),
      publicKey: "key-a",
      scheme: AttestedScheme.P256_OIDC,
    });

    const pending = stamper.stamp("payload");
    stamper.configure({
      attestedIdentity: verificationTokenFor("key-b"),
      publicKey: "key-b",
      scheme: AttestedScheme.P256_VERIFICATION_TOKEN,
    });

    expect(decodeStamp((await pending).stampHeaderValue)).toEqual({
      publicKeyAttestation: oidcTokenFor("key-a"),
      scheme: AttestedScheme.P256_OIDC,
      publicKey: "key-a",
      signature: "sig:key-a",
    });
  });
});
