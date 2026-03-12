import type { TurnstileInstance } from "@marsidev/react-turnstile";

/**
 * Polls for a captcha token to become available, resolving immediately if one already exists.
 * Returns null if the timeout is reached without a token.
 */
export const waitForCaptchaToken = (
  getTurnstileToken: () => string | null,
  timeoutMs = 5000,
): Promise<string | null> => {
  return new Promise((resolve) => {
    const token = getTurnstileToken();
    if (token) return resolve(token);

    const interval = 200;
    let elapsed = 0;
    const poll = setInterval(() => {
      elapsed += interval;
      const t = getTurnstileToken();
      if (t) {
        clearInterval(poll);
        return resolve(t);
      }
      if (elapsed >= timeoutMs) {
        clearInterval(poll);
        return resolve(null);
      }
    }, interval);
  });
};

/**
 * Waits for a captcha token, then consumes it (clears state and resets the widget for a fresh token).
 * Returns `{ captchaToken }` if a token was available, or `{}` if timed out.
 */
export const consumeCaptchaToken = async (
  getTurnstileToken: () => string | null,
  setTurnstileToken: (token: string | null) => void,
  turnstileRef?: React.RefObject<TurnstileInstance | null>,
): Promise<{ captchaToken: string } | Record<string, never>> => {
  const token = await waitForCaptchaToken(getTurnstileToken);
  if (token) {
    setTurnstileToken(null);
    turnstileRef?.current?.reset();
    return { captchaToken: token };
  }
  return {};
};
