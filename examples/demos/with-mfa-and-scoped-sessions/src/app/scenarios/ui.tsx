"use client";

import type { ReactNode } from "react";

const ERROR_HINTS: { match: string; hint: string }[] = [
  {
    match: "mfa policy order must be unique",
    hint: 'This user already has a policy at that order. Use "Reset MFA policies" to clear them, "Delete this sub-organization" to start the scenario over, or use a fresh email.',
  },
  {
    match: "attested stamps are only supported for sub-organizations",
    hint: "This email resolved to the parent organization, so it is not bound to a sub-organization for this auth proxy config. Use a fresh test email, run setup through email OTP, add the passkey, create the policies for that user, then log out and test the MFA OTP flow.",
  },
  {
    match: "enclave quorum public keys",
    hint: "The API and export iframe are pointed at different environments. Set NEXT_PUBLIC_EXPORT_IFRAME_URL to the iframe that matches NEXT_PUBLIC_BASE_URL.",
  },
  {
    match: "Google Client ID is not configured",
    hint: "Enable Google on the auth proxy config for this organization. The demo reads the client ID from the resolved config, so nothing client-side will fix this.",
  },
  {
    match: "oauthRedirectUri",
    hint: "No OAuth redirect URI resolved. It comes from the auth proxy config, or from NEXT_PUBLIC_OAUTH_REDIRECT_URI locally. Google needs it alongside the client ID.",
  },
  {
    match: "Failed to initialize OTP",
    hint: "OTP initialization failed in auth proxy. Check the auth proxy config, email delivery, or dev auth proxy health.",
  },
  {
    match: "No policies evaluated to outcome: Allow",
    hint: "The activity was denied. If you are using a scoped session, the session scope is the likely blocker even though the message talks about policies: a scope denial and a policy denial look identical from here.",
  },
];

/**
 * Turnkey SDK errors wrap the server error: `TurnkeyError.message` is a generic
 * "Failed to ..." and the useful text is on `cause`. Walk the chain so hints can match
 * the real message, and so the reader sees it.
 */
function errorChain(error: unknown, depth = 0): string[] {
  if (error == null || depth > 5) return [];
  if (typeof error === "string") return [error];

  if (typeof error === "object") {
    const { message, cause } = error as { message?: unknown; cause?: unknown };

    return [
      ...(typeof message === "string" ? [message] : []),
      ...errorChain(cause, depth + 1),
    ];
  }

  return [String(error)];
}

export function formatError(error: unknown) {
  const chain = errorChain(error);
  const message = chain.join("\n") || String(error);
  const hint = ERROR_HINTS.find(({ match }) => message.includes(match))?.hint;

  return hint ? `${message}\n\n${hint}` : message;
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "error";
  children: ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "border-green-200 bg-green-50"
      : tone === "error"
        ? "border-red-200 bg-red-50"
        : "border-gray-200 bg-gray-50";

  return (
    <div
      className={`w-full whitespace-pre-wrap break-words rounded border px-3 py-2 text-center text-xs text-black ${toneClass}`}
    >
      {children}
    </div>
  );
}

export function ScenarioCard({ children }: { children: ReactNode }) {
  return (
    <div className="w-[min(92vw,28rem)] rounded-lg border border-gray-200 bg-white p-5 text-black shadow-sm">
      <div className="flex flex-col items-center justify-center gap-4">
        {children}
      </div>
    </div>
  );
}

export function ScenarioHeader({
  title,
  subtitle,
  description,
}: {
  title: string;
  subtitle: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <h2 className="text-xl font-semibold text-black">{title}</h2>
      <p className="text-center text-sm font-medium text-black">{subtitle}</p>
      {description && (
        <p className="text-center text-xs leading-5 text-gray-600">
          {description}
        </p>
      )}
    </div>
  );
}

export function SessionInfo({
  session,
  children,
}: {
  session: { userId: string; organizationId: string };
  children?: ReactNode;
}) {
  return (
    <div className="w-full rounded border border-gray-200 bg-gray-50 p-3 text-center font-mono text-xs text-black">
      <div>User: {session.userId}</div>
      <div>Org: {session.organizationId}</div>
      {children}
    </div>
  );
}

/** A labelled group of controls, so two paths on one screen cannot be mistaken for one. */
export function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-3 rounded border border-gray-200 bg-gray-50 p-3">
      <div>
        <p className="text-xs font-semibold text-black">{title}</p>
        {hint && <p className="mt-1 text-xs leading-5 text-gray-600">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Prerequisites that must exist before a policy can be created, and whether they do. */
export function Checklist({
  items,
}: {
  items: { label: string; done: boolean; detail?: string }[];
}) {
  return (
    <ul className="flex w-full flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-3">
      {items.map((item) => (
        <li key={item.label} className="flex gap-2 text-xs text-black">
          <span className={item.done ? "text-green-700" : "text-gray-400"}>
            {item.done ? "✓" : "○"}
          </span>
          <span className="min-w-0 flex-1">
            {item.label}
            {item.detail && (
              <span className="mt-0.5 block break-all font-mono text-gray-600">
                {item.detail}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function OrDivider() {
  return (
    <div className="flex w-full items-center gap-3">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-xs uppercase tracking-wide text-gray-500">or</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black placeholder:text-gray-400"
    />
  );
}

const buttonBaseClass =
  "w-full rounded px-4 py-2 text-sm font-medium text-black transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${buttonBaseClass} bg-blue-100 hover:bg-blue-200`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${buttonBaseClass} border border-gray-300 bg-white hover:bg-gray-50`}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${buttonBaseClass} bg-red-100 hover:bg-red-200`}
    >
      {children}
    </button>
  );
}

/**
 * Shown once an action has succeeded, in the spirit of the passkey confirmation in
 * react-wallet-kit. It does not auto-dismiss: unlike "passkey added", what was written here
 * is worth reading before it disappears.
 */
export function SuccessDialog({
  open,
  title,
  description,
  closeLabel = "Done",
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  closeLabel?: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex flex-col items-center gap-2 border-b border-gray-100 px-5 py-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-xl text-green-700">
            ✓
          </div>
          <h3 className="text-sm font-semibold text-black">{title}</h3>
          {description && (
            <p className="text-center text-xs text-gray-600">{description}</p>
          )}
        </div>

        {children && (
          <div className="flex-1 overflow-auto px-5 py-4">{children}</div>
        )}

        <div className="border-t border-gray-100 px-5 py-4">
          <PrimaryButton onClick={onClose}>{closeLabel}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/** Compact "what was written" list for the success screen. */
export function PolicySummary({
  policies,
}: {
  policies: { mfaPolicyName: string; condition: string; order: number }[];
}) {
  return (
    <ul className="flex w-full flex-col gap-2">
      {policies.map((policy) => (
        <li
          key={policy.order}
          className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-black"
        >
          <div className="font-medium">
            {policy.order}. {policy.mfaPolicyName}
          </div>
          <div className="mt-0.5 font-mono text-gray-600">
            {policy.condition}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatusNotices({
  otpSent,
  otpVerified,
  mfaStatus,
  exportCompleted,
  error,
}: {
  otpSent?: boolean;
  otpVerified?: boolean;
  mfaStatus?: "idle" | "requested" | "approved";
  exportCompleted?: boolean;
  error?: string | null;
}) {
  return (
    <>
      {otpSent && !otpVerified && (
        <Notice>OTP sent. Enter the code from your email.</Notice>
      )}
      {otpVerified && <Notice tone="success">Email OTP verified.</Notice>}
      {mfaStatus && mfaStatus !== "idle" && (
        <Notice tone="success">Passkey MFA {mfaStatus}.</Notice>
      )}
      {exportCompleted && <Notice tone="success">Export completed.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
    </>
  );
}

export function PolicyGrid({ policies }: { policies: unknown[] }) {
  return (
    <div className="flex w-full flex-col gap-2">
      {policies.map((policy, index) => (
        <pre
          key={index}
          className="max-h-80 w-full min-w-0 overflow-auto rounded border border-gray-300 bg-gray-50 p-3 text-left font-mono text-xs leading-5 text-black"
        >
          {JSON.stringify(policy, null, 2)}
        </pre>
      ))}
    </div>
  );
}
