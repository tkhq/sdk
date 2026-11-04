"use client";

import { useState } from "react";

import { BASE_SEPOLIA_EXPLORER } from "@/lib/deposit";

export const INPUT_CLASS =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-slate-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500";

export const PRIMARY_BUTTON_CLASS =
  "rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50";

export const TEXT_BUTTON_CLASS =
  "text-xs text-slate-500 hover:text-slate-900 hover:underline";

export function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ErrorNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs break-words text-red-700">
      {children}
    </p>
  );
}

export function TxLink({ hash }: { hash: string }) {
  return (
    <a
      href={`${BASE_SEPOLIA_EXPLORER}/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      title={hash}
      className="font-mono text-slate-700 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-700"
    >
      {hash.slice(0, 10)}…{hash.slice(-8)}
    </a>
  );
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={TEXT_BUTTON_CLASS}
    >
      {copied ? "Copied" : "Copy address"}
    </button>
  );
}
