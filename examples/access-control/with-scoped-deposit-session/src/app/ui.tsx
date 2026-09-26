"use client";

import type { ReactNode } from "react";

const ERROR_HINTS: { match: string; hint: string }[] = [
  {
    match: "No policies evaluated to outcome: Allow",
    hint: "Denied. With a scoped session this is the session scope saying no, even though the message talks about policies: a scope denial and a policy denial read the same from here.",
  },
  {
    match: "internal server error",
    hint: "If this came from a session-stamped call, the scope could not be evaluated on it, for example a calldata slice that runs past the end of a short call. The call was refused; Turnkey reports the evaluation error as a 500 rather than a denial.",
  },
  {
    match: "timed out or was not allowed",
    hint: "The passkey prompt was cancelled or timed out.",
  },
  {
    match: "insufficient",
    hint: "Check the USDC balance of the wallet. The Circle faucet at https://faucet.circle.com sends 10 USDC per hour to a Base Sepolia address.",
  },
];

/**
 * Turnkey SDK errors wrap the server error: the useful text is usually on
 * `cause`. Walk the chain so hints can match the real message.
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

export function formatError(error: unknown): string {
  const chain = errorChain(error);
  let fallback: string;
  try {
    fallback =
      error && typeof error === "object"
        ? (JSON.stringify(error) ?? String(error))
        : String(error);
  } catch {
    fallback = String(error);
  }
  const message = chain.join("\n") || fallback;
  const hint = ERROR_HINTS.find(({ match }) => message.includes(match))?.hint;
  return hint ? `${message}\n\n${hint}` : message;
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="w-[min(94vw,40rem)] rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function Header({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold">{title}</h1>
      {subtitle && (
        <p className="text-sm leading-6 text-gray-600">{subtitle}</p>
      )}
    </div>
  );
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
      className={`w-full whitespace-pre-wrap break-words rounded border px-3 py-2 text-xs leading-5 ${toneClass}`}
    >
      {children}
    </div>
  );
}

/** A labelled group of controls. */
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
        <p className="text-xs font-semibold">{title}</p>
        {hint && <p className="mt-1 text-xs leading-5 text-gray-600">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function KeyValue({
  rows,
}: {
  rows: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid w-full grid-cols-[max-content_1fr] gap-x-3 gap-y-1 rounded border border-gray-200 bg-gray-50 p-3 font-mono text-xs">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-gray-500">{row.label}</dt>
          <dd className="min-w-0 break-all">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pre({ children }: { children: ReactNode }) {
  return (
    <pre className="w-full overflow-x-auto rounded border border-gray-200 bg-white p-3 font-mono text-xs leading-5">
      {children}
    </pre>
  );
}

const buttonBase =
  "w-full rounded px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

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
      className={`${buttonBase} bg-blue-100 hover:bg-blue-200`}
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
      className={`${buttonBase} border border-gray-300 bg-white hover:bg-gray-50`}
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
      className={`${buttonBase} bg-red-100 hover:bg-red-200`}
    >
      {children}
    </button>
  );
}
