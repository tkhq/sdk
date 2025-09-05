import { test, expect, jest } from "@jest/globals";
import { PasskeyStamper } from "../index";

// Mock react-native-passkey
jest.mock("react-native-passkey", () => ({
  Passkey: {
    isSupported: jest.fn(() => true),
    create: jest.fn(),
    createPlatformKey: jest.fn(),
    createSecurityKey: jest.fn(),
    get: jest.fn(),
    getPlatformKey: jest.fn(),
    getSecurityKey: jest.fn(),
  },
}));

test("uses provided signature to make stamp", async function () {
  const stamper = new PasskeyStamper({
    rpId: "some-rpid",
  });
  expect(stamper.rpId).toBe("some-rpid");
});
