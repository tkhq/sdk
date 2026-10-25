import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

jest.mock("@utils", () => jest.requireActual("../utils"), { virtual: true });

import { CrossPlatformPasskeyStamper } from "../__stampers__/passkey/base";
import type { TPasskeyStamperConfig } from "../__types__";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator",
);
const createCredential = jest.fn<typeof navigator.credentials.create>();

describe("CrossPlatformPasskeyStamper.createWebPasskey", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { PublicKeyCredential: class {} },
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { credentials: { create: createCredential } },
    });
    createCredential.mockResolvedValue({
      type: "public-key",
      id: "credential-id",
      rawId: new Uint8Array([1]).buffer,
      response: {
        clientDataJSON: new Uint8Array([2]).buffer,
        attestationObject: new Uint8Array([3]).buffer,
        getTransports: () => ["internal"],
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);
  });

  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      Reflect.deleteProperty(globalThis, "navigator");
    }
    jest.clearAllMocks();
  });

  it.each<{
    description: string;
    stamperConfig: TPasskeyStamperConfig;
    request: Record<string, unknown>;
    expectedRp: { id: string | undefined; name: string };
  }>([
    {
      description: "uses the configured RP name when the request omits it",
      stamperConfig: { rpId: "example.com", rpName: "Example App" },
      request: {},
      expectedRp: { id: "example.com", name: "Example App" },
    },
    {
      description:
        "prefers the request RP name without changing the configured ID",
      stamperConfig: { rpId: "example.com", rpName: "Example App" },
      request: { publicKey: { rp: { name: "Request App" } } },
      expectedRp: { id: "example.com", name: "Request App" },
    },
    {
      description: "preserves an explicit empty request RP name",
      stamperConfig: { rpId: "example.com", rpName: "Example App" },
      request: { publicKey: { rp: { name: "" } } },
      expectedRp: { id: "example.com", name: "" },
    },
    {
      description: "keeps the empty fallback when neither RP name is supplied",
      stamperConfig: { rpId: "example.com" },
      request: {},
      expectedRp: { id: "example.com", name: "" },
    },
    {
      description: "preserves a request RP ID alongside the configured name",
      stamperConfig: { rpId: "example.com", rpName: "Example App" },
      request: { publicKey: { rp: { id: "login.example.com" } } },
      expectedRp: { id: "login.example.com", name: "Example App" },
    },
    {
      description: "does not infer an RP ID from the configured name",
      stamperConfig: { rpName: "Example App" },
      request: {},
      expectedRp: { id: undefined, name: "Example App" },
    },
  ])("$description", async ({ stamperConfig, request, expectedRp }) => {
    const stamper = new CrossPlatformPasskeyStamper(stamperConfig);

    const result = await stamper.createWebPasskey(request);

    expect(createCredential).toHaveBeenCalledTimes(1);
    expect(createCredential).toHaveBeenCalledWith({
      publicKey: expect.objectContaining({ rp: expectedRp }),
    });
    expect(result.attestation.credentialId).toBe("AQ");
  });
});
