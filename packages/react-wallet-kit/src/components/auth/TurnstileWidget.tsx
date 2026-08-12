import { useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "./Turnstile";
import { useTurnkey } from "../../providers/client/Hook";
import { consumeCaptchaToken } from "../../utils/captcha";

// How long `requestToken` waits for the user to clear an interactive challenge
// before giving up. Generous, because the challenge only starts once the user
// has asked for the gated action.
const INTERACTIVE_CHALLENGE_TIMEOUT_MS = 120_000;

interface UseTurnstileOptions {
  // Allows the caller to hide the widget while it's busy (e.g. while a request
  // is in flight). The widget is still subject to its own visibility rules.
  visible?: boolean;
  // When true, nothing is rendered until `requestToken()` is called. Use this on
  // screens where the captcha only guards an optional secondary action, so users
  // who never take that action are never shown a challenge.
  deferred?: boolean;
}

/**
 * Encapsulates all Cloudflare Turnstile state and behaviour shared across the
 * auth flows (the main auth modal and the OTP verification screen).
 *
 * Returns a ready-to-render `turnstile` element (or `null` when it shouldn't be
 * shown) plus the pieces callers need to gate their UI:
 * - `authEnabled` / captcha-ready: `false` until a token is available (or
 *   immediately `true` when no turnstile is configured / a token already
 *   existed on mount). Cleared when a token is consumed or wait times out,
 *   then set back to `true` on widget `onSuccess`.
 * - `consumeToken`: waits for and consumes the current token before a request.
 * - `requestToken`: mounts the widget on demand (in `deferred` mode) and waits
 *   for the user to clear the challenge before consuming the token.
 * - `turnstileConfigured`: whether a Turnstile site key is present.
 */
export function useTurnstile(options?: UseTurnstileOptions) {
  const { visible = true, deferred = false } = options ?? {};
  const { config, getTurnstileToken, setTurnstileToken } = useTurnkey();

  const turnstileConfigured = !!config?.turnstileSiteKey;
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [showTurnstilePrompt, setShowTurnstilePrompt] = useState(false);
  // If a token already existed when the component mounted, we don't need to show the widget at all
  const [hadTokenOnMount] = useState(() => !!getTurnstileToken());
  const [showTurnstileError, setShowTurnstileError] = useState(false);
  const [showTurnstileExpired, setShowTurnstileExpired] = useState(false);
  // Auth is enabled immediately if no turnstile is configured, or if the Provider already has a token
  const [authEnabled, setAuthEnabled] = useState(
    !turnstileConfigured || hadTokenOnMount,
  );
  const [turnstileErrorMessage, setTurnstileErrorMessage] = useState<
    string | null
  >(null);
  // In deferred mode the widget stays unmounted until `requestToken` arms it.
  const [armed, setArmed] = useState(!deferred);
  // Resolver for an in-flight `requestToken`, settled by onSuccess/onError.
  const pendingToken = useRef<((token: string | null) => void) | null>(null);

  const settlePendingToken = (token: string | null) => {
    pendingToken.current?.(token);
    pendingToken.current = null;
  };

  const consumeToken = async () => {
    const result = await consumeCaptchaToken(
      getTurnstileToken,
      (token) => {
        setTurnstileToken(token);
        // Cleared on consume/reset — keep actions disabled until onSuccess.
        if (token === null && turnstileConfigured) {
          setAuthEnabled(false);
        }
      },
      turnstileRef,
    );
    // Timed out with no token — ensure gated actions stay disabled.
    if (turnstileConfigured && !("captchaToken" in result)) {
      setAuthEnabled(false);
    }
    return result;
  };

  /**
   * Obtains a token for a user-initiated action. Resolves right away when one is
   * already pre-warmed, so no challenge is ever shown; otherwise mounts the
   * widget now and waits for the user to clear it. Returns `{}` if the challenge
   * failed or was never completed.
   */
  const requestToken = async () => {
    if (!turnstileConfigured) return {};
    if (getTurnstileToken()) return consumeToken();

    setArmed(true);
    const token = await new Promise<string | null>((resolve) => {
      pendingToken.current = resolve;
      setTimeout(() => {
        if (pendingToken.current === resolve) settlePendingToken(null);
      }, INTERACTIVE_CHALLENGE_TIMEOUT_MS);
    });
    // Re-hide so an unused challenge never lingers on screen.
    if (deferred) setArmed(false);

    // onSuccess already stored the token, so consumeToken resolves immediately.
    return token ? consumeToken() : {};
  };

  const shouldRender =
    turnstileConfigured &&
    visible &&
    // Deferred callers render only once `requestToken` arms them; whether a token
    // existed at mount is moot by then, since it's already been consumed.
    (deferred ? armed : !hadTokenOnMount || showTurnstileError);

  const onSuccess = (token: string) => {
    setTurnstileToken(token);
    setAuthEnabled(true);
    setTurnstileErrorMessage(null);
    settlePendingToken(token);
  };

  const onError = () => {
    setTurnstileToken(null);
    setAuthEnabled(false);
    setShowTurnstileError(true);
    setTurnstileErrorMessage("Verification failed. Please try again.");
    settlePendingToken(null);
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

  return {
    turnstile,
    consumeToken,
    requestToken,
    authEnabled,
    turnstileConfigured,
  };
}
