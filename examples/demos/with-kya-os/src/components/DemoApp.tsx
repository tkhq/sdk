"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { ActionResponse, DemoAction, DemoResult, DemoState } from "../api";
import { ActionButton, Card, Notice } from "./ui";

type Activity = {
  id: number;
  time: string;
  text: string;
  tone: "info" | "success" | "error";
};

function describe(result: DemoResult): Pick<Activity, "text" | "tone"> {
  if ("verification" in result) {
    const allowed = result.outcome === "allowed";
    return {
      text: `${allowed ? "Tool executed" : "Tool did not execute"} · ${result.outcome} · server proof ${result.verification.valid ? "verified" : "FAILED"}`,
      tone: result.verification.valid
        ? allowed
          ? "success"
          : "info"
        : "error",
    };
  }
  if ("valid" in result)
    return {
      text: result.valid
        ? result.bindsResponse
          ? "Verified the server identity, signature, and request/result binding using public keys only."
          : "Verified the signed denial and its request binding. Denial proofs do not cover the response body."
        : `Verification failed: ${result.reason}`,
      tone: result.valid ? "success" : "error",
    };
  return { text: result.message, tone: "success" };
}

export function DemoApp({ initialState }: { initialState: DemoState }) {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const nextId = useRef(0);
  const busy = useRef(false);

  function log(entry: Pick<Activity, "text" | "tone">) {
    const event = {
      ...entry,
      id: nextId.current++,
      time: new Date().toLocaleTimeString(),
    };
    setActivity((previous) => [event, ...previous].slice(0, 25));
  }

  async function act(action: DemoAction, label: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(label);
    try {
      const response = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok)
        throw new Error(
          "Action failed. Check the configuration and current demo step.",
        );
      const payload = (await response.json()) as ActionResponse;
      setState(payload.state);
      log(describe(payload.result));
    } catch (error) {
      log({
        text:
          error instanceof Error
            ? error.message
            : "Could not connect to the demo.",
        tone: "error",
      });
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  const granted = Boolean(state.delegation);
  const buttons: {
    label: string;
    action: DemoAction;
    disabled?: boolean;
    tone?: "primary" | "danger";
  }[] = [
    { label: "Call protected tool", action: "call", tone: "primary" },
    {
      label: "Approve reports:read",
      action: "approve",
      tone: "primary",
      disabled: granted,
    },
    {
      label: "Retry with delegation",
      action: "call",
      disabled: !granted || state.revoked,
    },
    {
      label: "Verify response proof",
      action: "verify",
      disabled: !state.receipt,
    },
    {
      label: "Revoke delegation",
      action: "revoke",
      tone: "danger",
      disabled: !granted || state.revoked,
    },
    {
      label: "Retry after revocation",
      action: "call",
      disabled: !state.revoked,
    },
  ];

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gray-50 px-4 py-8 text-black">
      <div className="w-full max-w-4xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <a href="https://turnkey.com" aria-label="Turnkey home">
            <Image
              src="/logo.svg"
              alt="Turnkey"
              width={116}
              height={26}
              priority
            />
          </a>
          <span className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600">
            {state.mode === "turnkey" ? "Turnkey signing" : "Local signing"}
          </span>
        </header>
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold">KYA-OS delegation demo</h1>
          <p className="mt-2 text-sm text-gray-600">
            Approve an agent’s permission, verify its response, then revoke
            access.
          </p>
        </div>
        <div className="grid items-start gap-5 md:grid-cols-2">
          <Card title="Consent flow">
            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs leading-5">
              <p className="font-semibold">Requested permission</p>
              <p className="mt-1">
                <code>get_report</code> requires <code>reports:read</code>.
              </p>
              <p className="text-gray-600">
                The delegation lasts ten minutes and belongs to this agent.
              </p>
            </div>
            <ol className="flex flex-col gap-2">
              {buttons.map(({ label, action, disabled, tone }, index) => (
                <li key={label} className="flex items-center gap-3">
                  <span
                    className="w-4 shrink-0 text-xs text-gray-500"
                    aria-hidden="true"
                  >
                    {index + 1}.
                  </span>
                  <ActionButton
                    tone={tone ?? "secondary"}
                    disabled={pending !== null || disabled}
                    aria-busy={pending === label}
                    onClick={() => void act(action, label)}
                  >
                    {pending === label ? "Running…" : label}
                  </ActionButton>
                </li>
              ))}
            </ol>
            <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-4">
              <ActionButton
                disabled={pending !== null}
                onClick={() => void act("scope", "Test another scope")}
              >
                Test another scope
              </ActionButton>
              <ActionButton
                disabled={pending !== null || !state.receipt}
                onClick={() => void act("replay", "Replay last request")}
              >
                Replay last request
              </ActionButton>
            </div>
            <p className="text-xs leading-5 text-gray-500">
              This tool returns a synthetic report. The approval button
              simulates human consent. Restart the app to reset.
            </p>
          </Card>
          <Card title="Result">
            <Notice
              tone={state.revoked ? "info" : granted ? "success" : "info"}
            >
              {state.revoked
                ? "Delegation revoked"
                : granted
                  ? "reports:read approved"
                  : "No delegation yet"}
            </Notice>
            <dl className="grid grid-cols-2 gap-3 rounded border border-gray-200 bg-gray-50 p-3 text-xs">
              <div>
                <dt className="text-gray-600">Tool executions</dt>
                <dd
                  className="mt-1 text-lg font-semibold"
                  data-testid="executions"
                >
                  {state.executions}
                </dd>
              </div>
              <div>
                <dt className="text-gray-600">Signing activities</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {state.signing.length}
                </dd>
              </div>
            </dl>
            <div
              role="log"
              aria-label="Activity"
              aria-live="polite"
              className="max-h-72 space-y-2 overflow-auto"
            >
              {activity.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-500">
                  Call the protected tool to start.
                </p>
              ) : (
                activity.map((event) => (
                  <div key={event.id}>
                    <p className="mb-1 text-xs text-gray-500">{event.time}</p>
                    <Notice tone={event.tone}>{event.text}</Notice>
                  </div>
                ))
              )}
            </div>
            {state.receipt ? (
              <details className="min-w-0 border-t border-gray-100 pt-3 text-xs">
                <summary className="font-medium">
                  Inspect signed response
                </summary>
                <pre className="mt-3 max-h-64 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-5">
                  {JSON.stringify(state.receipt.response, null, 2)}
                </pre>
                <a
                  href="/api/receipt"
                  download="kya-os-receipt.json"
                  className="mt-3 inline-block text-blue-700 underline underline-offset-2"
                >
                  Download public receipt
                </a>
              </details>
            ) : null}
          </Card>
        </div>
        <details className="mt-5 rounded-lg border border-gray-200 bg-white p-4 text-xs shadow-sm">
          <summary className="font-semibold">Signing identities</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {Object.entries(state.identities).map(([role, identity]) => (
              <div key={role} className="min-w-0">
                <h3 className="mb-1 font-semibold">
                  {role === "issuer"
                    ? "Human / issuer"
                    : role === "server"
                      ? "Server"
                      : "Agent"}
                </h3>
                <code className="break-all text-xs leading-5 text-gray-600">
                  {identity.did}
                </code>
              </div>
            ))}
          </div>
        </details>
        <footer className="mt-5 text-center text-xs leading-5 text-gray-500">
          {state.mode === "turnkey"
            ? "Signatures use the configured Turnkey keys. API credentials stay on the server."
            : "Local mode uses disposable, non-extractable keys. No Turnkey API calls are made."}
        </footer>
      </div>
    </main>
  );
}
