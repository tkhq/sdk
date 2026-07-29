import {
  describe,
  jest,
  beforeEach,
  afterEach,
  it,
  expect,
} from "@jest/globals";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { waitForCaptchaToken, consumeCaptchaToken } from "../utils/captcha";

describe("captcha utilities", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("waitForCaptchaToken", () => {
    it("resolves immediately when a token already exists", async () => {
      await expect(
        waitForCaptchaToken(() => "token-ready"),
      ).resolves.toBe("token-ready");
    });

    it("resolves when a token appears during polling", async () => {
      let token: string | null = null;
      const pending = waitForCaptchaToken(() => token, 2000);

      jest.advanceTimersByTime(400);
      token = "token-later";
      jest.advanceTimersByTime(200);

      await expect(pending).resolves.toBe("token-later");
    });

    it("resolves null when the timeout elapses without a token", async () => {
      const pending = waitForCaptchaToken(() => null, 1000);

      jest.advanceTimersByTime(1000);

      await expect(pending).resolves.toBeNull();
    });

    it("does not resolve null before the timeout", async () => {
      const onDone = jest.fn();
      const pending = waitForCaptchaToken(() => null, 1000).then(onDone);

      jest.advanceTimersByTime(999);
      expect(onDone).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      await pending;
      expect(onDone).toHaveBeenCalledWith(null);
    });
  });

  describe("consumeCaptchaToken", () => {
    it("returns captchaToken, clears state, and resets the widget", async () => {
      const setTurnstileToken = jest.fn();
      const reset = jest.fn();
      const turnstileRef = {
        current: { reset } as unknown as TurnstileInstance,
      };

      await expect(
        consumeCaptchaToken(() => "tok_abc", setTurnstileToken, turnstileRef),
      ).resolves.toEqual({ captchaToken: "tok_abc" });

      expect(setTurnstileToken).toHaveBeenCalledWith(null);
      expect(reset).toHaveBeenCalledTimes(1);
    });

    it("works without a turnstile ref when a token is available", async () => {
      const setTurnstileToken = jest.fn();

      await expect(
        consumeCaptchaToken(() => "tok_no_ref", setTurnstileToken),
      ).resolves.toEqual({ captchaToken: "tok_no_ref" });

      expect(setTurnstileToken).toHaveBeenCalledWith(null);
    });

    it("returns {} and warns when waiting times out", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const setTurnstileToken = jest.fn();
      const pending = consumeCaptchaToken(() => null, setTurnstileToken);

      jest.advanceTimersByTime(5000);

      await expect(pending).resolves.toEqual({});
      expect(setTurnstileToken).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("CAPTCHA token timed out"),
      );
    });

    it("consumes a token that arrives during the wait", async () => {
      let token: string | null = null;
      const setTurnstileToken = jest.fn();
      const pending = consumeCaptchaToken(() => token, setTurnstileToken);

      jest.advanceTimersByTime(600);
      token = "tok_delayed";
      jest.advanceTimersByTime(200);

      await expect(pending).resolves.toEqual({ captchaToken: "tok_delayed" });
      expect(setTurnstileToken).toHaveBeenCalledWith(null);
    });
  });
});
