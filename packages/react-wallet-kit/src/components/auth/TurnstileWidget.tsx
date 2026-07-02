import { useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useTurnkey } from "../../providers/client/Hook";
import { consumeCaptchaToken } from "../../utils/captcha";

interface UseTurnstileOptions {
  // Allows the caller to hide the widget while it's busy (e.g. while a request
  // is in flight). The widget is still subject to its own visibility rules.
  visible?: boolean;
}

/**
 * Encapsulates all Cloudflare Turnstile state and behaviour shared across the
 * auth flows (the main auth modal and the OTP verification screen).
 *
 * Returns a ready-to-render `turnstile` element (or `null` when it shouldn't be
 * shown) plus the pieces callers need to gate their UI:
 * - `authEnabled`: `false` until a token is available (or immediately `true`
 *   when no turnstile is configured / a token already existed on mount).
 * - `consumeToken`: waits for and consumes the current token before a request.
 */
export function useTurnstile(options?: UseTurnstileOptions) {
  const { visible = true } = options ?? {};
  const { config, getTurnstileToken, setTurnstileToken } = useTurnkey();

  const turnstileRef = useRef<TurnstileInstance>(null);
  const [showTurnstilePrompt, setShowTurnstilePrompt] = useState(false);
  // If a token already existed when the component mounted, we don't need to show the widget at all
  const [hadTokenOnMount] = useState(() => !!getTurnstileToken());
  const [showTurnstileError, setShowTurnstileError] = useState(false);
  const [showTurnstileExpired, setShowTurnstileExpired] = useState(false);
  // Auth is enabled immediately if no turnstile is configured, or if the Provider already has a token
  const [authEnabled, setAuthEnabled] = useState(
    !config?.turnstileSiteKey || hadTokenOnMount,
  );
  const [turnstileErrorMessage, setTurnstileErrorMessage] = useState<
    string | null
  >(null);

  const consumeToken = () =>
    consumeCaptchaToken(getTurnstileToken, setTurnstileToken, turnstileRef);

  const shouldRender =
    !!config?.turnstileSiteKey &&
    visible &&
    (!hadTokenOnMount || showTurnstileError);

  const onSuccess = (token: string) => {
    setTurnstileToken(token);
    setAuthEnabled(true);
    setTurnstileErrorMessage(null);
  };

  const onError = () => {
    setTurnstileToken(null);
    setShowTurnstileError(true);
    setTurnstileErrorMessage("Verification failed. Please try again.");
  };

  const onExpire = () => {
    setTurnstileToken(null);
    setAuthEnabled(false);
    setShowTurnstileExpired(true);
    turnstileRef.current?.reset();
  };

  const turnstile =
    shouldRender && config?.turnstileSiteKey ? (
      <>
        <div className="mt-3 flex flex-col text-left w-full">
          {showTurnstileExpired ? (
            <p className="text-icon-text-light/70 dark:text-icon-text-dark/70 text-sm mb-0.5">
              Verification expired - retrying...
            </p>
          ) : showTurnstilePrompt ? (
            <p className="text-icon-text-light/70 dark:text-icon-text-dark/70 text-sm mb-0.5">
              Let us know you're human
            </p>
          ) : null}
          <Turnstile
            ref={turnstileRef}
            id="auth-component-turnstile"
            siteKey={config.turnstileSiteKey}
            className="!w-full !block [&>iframe]:!w-full [&>iframe]:!bg-transparent"
            onSuccess={onSuccess}
            onError={onError}
            onExpire={onExpire}
            onBeforeInteractive={() => {
              setShowTurnstilePrompt(true);
            }}
            options={{
              theme: config.ui?.darkMode ? "dark" : "light",
              appearance: "interaction-only",
              size: "flexible",
            }}
          />
        </div>
        {turnstileErrorMessage && (
          <p className="text-red-500 dark:text-red-400 text-sm mt-2 text-center">
            {turnstileErrorMessage}
          </p>
        )}
      </>
    ) : null;

  return { turnstile, consumeToken, authEnabled };
}
