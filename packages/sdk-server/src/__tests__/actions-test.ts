import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import type { TurnkeySDKServerConfig } from "../__types__/base";

const getUsers = jest.fn<() => Promise<{ users: [] }>>();
const getSubOrgIds = jest.fn<() => Promise<{ organizationIds: string[] }>>();
const getVerifiedSubOrgIds =
  jest.fn<() => Promise<{ organizationIds: string[] }>>();
const apiClient = jest.fn(() => ({
  getUsers,
  getSubOrgIds,
  getVerifiedSubOrgIds,
}));
const createSDK = jest.fn((config: TurnkeySDKServerConfig) => ({
  config,
  apiClient,
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  jest.doMock("../sdk-client", () => ({ TurnkeyServerSDK: createSDK }));
  jest.replaceProperty(process, "env", {
    ...process.env,
    NEXT_PUBLIC_BASE_URL: "https://example.com",
    NEXT_PUBLIC_ORGANIZATION_ID: "parent-org",
    TURNKEY_API_PRIVATE_KEY: "test-private-key",
    TURNKEY_API_PUBLIC_KEY: "test-public-key",
  });
  getUsers.mockResolvedValue({ users: [] });
  getSubOrgIds.mockResolvedValue({ organizationIds: ["suborg"] });
  getVerifiedSubOrgIds.mockResolvedValue({
    organizationIds: ["verified-suborg"],
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("reads configuration and creates the SDK only when an action is used", async () => {
  const actions: typeof import("../actions") = require("../actions");
  expect(createSDK).not.toHaveBeenCalled();

  process.env.NEXT_PUBLIC_ORGANIZATION_ID = "configured-after-import";
  await expect(actions.getUsers({ organizationId: "suborg" })).resolves.toEqual(
    {
      users: [],
    },
  );
  expect(createSDK).toHaveBeenCalledTimes(1);
  expect(createSDK).toHaveBeenCalledWith({
    apiBaseUrl: "https://example.com",
    defaultOrganizationId: "configured-after-import",
    apiPrivateKey: "test-private-key",
    apiPublicKey: "test-public-key",
  });
  expect(getUsers).toHaveBeenCalledWith({ organizationId: "suborg" });
});

test("reuses the initialized SDK and its organization across actions", async () => {
  const actions: typeof import("../actions") = require("../actions");
  await actions.getUsers({ organizationId: "suborg" });
  process.env.NEXT_PUBLIC_ORGANIZATION_ID = "changed-after-initialization";

  const request = { filterType: "EMAIL", filterValue: "test@example.com" };
  await expect(actions.getSuborgs(request)).resolves.toEqual({
    organizationIds: ["suborg"],
  });
  await expect(actions.getVerifiedSuborgs(request)).resolves.toEqual({
    organizationIds: ["verified-suborg"],
  });
  expect(createSDK).toHaveBeenCalledTimes(1);
  expect(getSubOrgIds).toHaveBeenCalledWith({
    organizationId: "parent-org",
    ...request,
  });
  expect(getVerifiedSubOrgIds).toHaveBeenCalledWith({
    organizationId: "parent-org",
    ...request,
  });
});

test("reports missing process on action use and permits a later retry", async () => {
  const actions: typeof import("../actions") = require("../actions");
  const nodeProcess = globalThis.process;
  const request = { filterType: "EMAIL", filterValue: "test@example.com" };
  let result: ReturnType<typeof actions.getSuborgs>;
  try {
    // Model a Worker without Node compatibility; restore before Jest runs.
    Object.defineProperty(globalThis, "process", { value: undefined });
    result = actions.getSuborgs(request);
  } finally {
    Object.defineProperty(globalThis, "process", { value: nodeProcess });
  }
  await expect(result).rejects.toThrow(
    "Server actions require environment variables via process.env",
  );
  expect(createSDK).not.toHaveBeenCalled();

  await expect(actions.getSuborgs(request)).resolves.toEqual({
    organizationIds: ["suborg"],
  });
  expect(createSDK).toHaveBeenCalledTimes(1);
});
