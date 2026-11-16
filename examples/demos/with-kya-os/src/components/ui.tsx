import type { ButtonHTMLAttributes, ReactNode } from "react";

// Follow the card, notice, and control styles in with-mfa-and-scoped-sessions.
export function Card({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section
      aria-label={title}
      className="min-w-0 rounded-lg border border-gray-200 bg-white p-5 text-black shadow-sm"
    >
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function ActionButton({
  tone = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger";
}) {
  const color =
    tone === "primary"
      ? "bg-blue-100 hover:bg-blue-200"
      : tone === "danger"
        ? "bg-red-100 hover:bg-red-200"
        : "border border-gray-300 bg-white hover:bg-gray-50";
  return (
    <button
      type="button"
      {...props}
      className={`w-full rounded px-4 py-2 text-sm font-medium text-black transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 ${color} ${className}`}
    />
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "error";
}) {
  const color =
    tone === "success"
      ? "border-green-200 bg-green-50"
      : tone === "error"
        ? "border-red-200 bg-red-50"
        : "border-gray-200 bg-gray-50";
  return (
    <p
      className={`rounded border px-3 py-2 text-xs leading-5 text-black ${color}`}
    >
      {children}
    </p>
  );
}
