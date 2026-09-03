"use client";

import type { ReactNode } from "react";

export function formatError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);

  if (message.includes("mfa policy order must be unique")) {
    return `${message}\n\nUse a fresh email/sub-organization, or reset policies before creating this scenario again.`;
  }

  if (
    message.includes("attested stamps are only supported for sub-organizations")
  ) {
    return `${message}\n\nThis email resolved to the parent organization, so it is not bound to a sub-organization for this auth proxy config. Use a fresh test email, run setup through email OTP, add the passkey, create the policies for that user, then log out and test the MFA OTP flow.`;
  }

  if (message.includes("enclave quorum public keys")) {
    return `${message}\n\nThe API and export iframe are pointed at different environments. Set NEXT_PUBLIC_EXPORT_IFRAME_URL to the iframe that matches NEXT_PUBLIC_BASE_URL.`;
  }

  if (message.includes("Failed to initialize OTP")) {
    return `${message}\n\nOTP initialization failed in auth proxy. Check the auth proxy config, email delivery, or dev auth proxy health.`;
  }

  return message;
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
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <h2 className="text-xl font-semibold text-black">{title}</h2>
      <p className="text-center text-sm text-gray-600">{subtitle}</p>
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
