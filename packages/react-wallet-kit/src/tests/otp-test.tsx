/** @jest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { OtpType } from "@turnkey/core";
import { OtpVerification } from "../components/auth/OTP";
import type { TurnkeyCallbacks } from "../types/base";

const mockCloseModal = jest.fn();
const mockCompleteOtp = jest.fn<(params: unknown) => Promise<unknown>>();
const mockVerifyOtp =
  jest.fn<
    (
      params: unknown,
    ) => Promise<{ verificationToken: string; publicKey: string }>
  >();
const mockDeleteApiKeyPair = jest.fn<(params: unknown) => Promise<void>>();
let mockCallbacks: TurnkeyCallbacks | undefined;

// `@turnkey/core` pulls in viem, which needs `TextEncoder` and other globals
// that jsdom lacks. The component only needs these values from it.
jest.mock("@turnkey/core", () => ({
  ...(jest.requireActual("@turnkey/sdk-types") as object),
  OtpType: { Email: "OTP_TYPE_EMAIL", Sms: "OTP_TYPE_SMS" },
}));

jest.mock("../providers/modal/Hook", () => ({
  useModal: () => ({
    closeModal: mockCloseModal,
    isMobile: false,
  }),
}));

jest.mock("../providers/client/Hook", () => ({
  useTurnkey: () => ({
    initOtp: jest.fn(),
    completeOtp: mockCompleteOtp,
    verifyOtp: mockVerifyOtp,
    deleteApiKeyPair: mockDeleteApiKeyPair,
    callbacks: mockCallbacks,
  }),
}));

jest.mock("../components/auth/TurnstileWidget", () => ({
  useTurnstile: () => ({
    turnstile: null,
    requestToken: async () => ({}),
    turnstileConfigured: false,
  }),
}));

const otpParams = {
  contact: "user@example.com",
  otpId: "otp-id",
  otpEncryptionTargetBundle: "bundle",
  otpType: OtpType.Email,
  sessionKey: "session-key",
};

async function renderAndEnterCode(code: string) {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  await act(async () => {
    root.render(<OtpVerification {...otpParams} otpLength={code.length} />);
  });

  // React listens for native "input" events; set the value through the
  // prototype setter so React's value tracker sees the change.
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  const inputs = container.querySelectorAll("input");
  for (let i = 0; i < code.length; i++) {
    await act(async () => {
      valueSetter.call(inputs[i], code[i]);
      inputs[i]!.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  return { container, root };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCallbacks = undefined;
  mockVerifyOtp.mockResolvedValue({
    verificationToken: "verification-token",
    publicKey: "public-key",
  });
  mockDeleteApiKeyPair.mockResolvedValue(undefined);
  mockCompleteOtp.mockResolvedValue({});
});

describe("OtpVerification with callbacks.onOtpVerified", () => {
  it("completes the login in the SDK when the callback is not set", async () => {
    const { root } = await renderAndEnterCode("123456");

    expect(mockCompleteOtp).toHaveBeenCalledWith({
      otpId: "otp-id",
      otpCode: "123456",
      otpEncryptionTargetBundle: "bundle",
      contact: "user@example.com",
      otpType: OtpType.Email,
      sessionKey: "session-key",
    });
    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(mockCloseModal).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });

  it("hands the verified code over to the host and closes the modal", async () => {
    const onOtpVerified = jest.fn<
      NonNullable<TurnkeyCallbacks["onOtpVerified"]>
    >(async () => {});
    mockCallbacks = { onOtpVerified };

    const { root } = await renderAndEnterCode("123456");

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      otpId: "otp-id",
      otpCode: "123456",
      otpEncryptionTargetBundle: "bundle",
    });
    expect(onOtpVerified).toHaveBeenCalledWith({
      verificationToken: "verification-token",
      publicKey: "public-key",
      contact: "user@example.com",
      otpType: OtpType.Email,
      sessionKey: "session-key",
    });
    expect(mockCompleteOtp).not.toHaveBeenCalled();
    expect(mockDeleteApiKeyPair).not.toHaveBeenCalled();
    expect(mockCloseModal).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });

  it("shows the host's error and deletes the key pair when the callback rejects", async () => {
    const onOtpVerified = jest.fn<
      NonNullable<TurnkeyCallbacks["onOtpVerified"]>
    >(async () => {
      throw new Error("Backend rejected the login");
    });
    mockCallbacks = { onOtpVerified };

    const { container, root } = await renderAndEnterCode("123456");

    expect(onOtpVerified).toHaveBeenCalledTimes(1);
    expect(mockDeleteApiKeyPair).toHaveBeenCalledWith({
      publicKey: "public-key",
    });
    expect(mockCloseModal).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Backend rejected the login");

    await act(async () => root.unmount());
  });

  it("does not call the host when verification fails", async () => {
    const onOtpVerified = jest.fn<
      NonNullable<TurnkeyCallbacks["onOtpVerified"]>
    >(async () => {});
    mockCallbacks = { onOtpVerified };
    mockVerifyOtp.mockRejectedValue(new Error("Failed to verify OTP"));

    const { container, root } = await renderAndEnterCode("123456");

    expect(onOtpVerified).not.toHaveBeenCalled();
    expect(mockDeleteApiKeyPair).not.toHaveBeenCalled();
    expect(mockCloseModal).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Failed to verify OTP");

    await act(async () => root.unmount());
  });
});
