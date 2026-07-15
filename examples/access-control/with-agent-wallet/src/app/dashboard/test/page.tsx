"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useTurnkey,
  AuthState,
  WalletSource,
  type Wallet,
} from "@turnkey/react-wallet-kit";
import type { ActivitySseMessage, ActivityEventEnvelope } from "@/lib/types";

const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_ATTEMPTS = 30;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVITY_STATUS_COMPLETED: "bg-green-100 text-green-800",
    ACTIVITY_STATUS_CONSENSUS_NEEDED: "bg-yellow-100 text-yellow-800",
    ACTIVITY_STATUS_FAILED: "bg-red-100 text-red-800",
    ACTIVITY_STATUS_REJECTED: "bg-red-100 text-red-800",
    ACTIVITY_STATUS_CREATED: "bg-gray-100 text-gray-700",
    ACTIVITY_STATUS_PENDING: "bg-blue-100 text-blue-700",
  };
  const label = status.replace("ACTIVITY_STATUS_", "").replace(/_/g, " ");
  const cls = map[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function CopyBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded border border-gray-100 bg-gray-50 px-3 py-2">
      <code className="flex-1 font-mono text-[11px] text-gray-800 break-all">
        {value}
      </code>
      <button
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="shrink-0 rounded bg-gray-200 px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-300"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export default function TestPage() {
  const router = useRouter();
  const { authState, logout, session, wallets, httpClient } = useTurnkey();

  useEffect(() => {
    if (authState === AuthState.Unauthenticated) router.replace("/");
  }, [authState, router]);

  const walletAddress = useMemo(() => {
    return (
      (wallets ?? [])
        .filter((w: Wallet) => w.source === WalletSource.Embedded)
        .flatMap((w) => w.accounts ?? [])
        .find((a) => a.addressFormat?.includes("ETHEREUM"))?.address ?? null
    );
  }, [wallets]);

  const orgId = session?.organizationId ?? null;

  // --- SSE event log ---
  const [events, setEvents] = useState<ActivityEventEnvelope[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.addEventListener("message", (e: MessageEvent) => {
      let msg: ActivitySseMessage;
      try {
        msg = JSON.parse(e.data as string);
      } catch {
        return;
      }

      if (msg.type === "connected") {
        setEvents(msg.recentEvents);
      } else if (msg.type === "activity-update") {
        setEvents((prev) => {
          const next = [
            msg.event,
            ...prev.filter((x) => x.id !== msg.event.id),
          ];
          return next.slice(0, 50);
        });
      }
    });

    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [events]);

  // --- User approval ---
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalResults, setApprovalResults] = useState<
    Record<string, string>
  >({});

  const handleApprove = async (
    fingerprint: string,
    activityId: string,
    activityOrgId: string,
  ) => {
    if (!httpClient || !orgId) return;
    setApprovingId(activityId);
    try {
      await httpClient.approveActivity({ fingerprint });

      let statusId: string | null = null;
      try {
        const { activity } = await httpClient.getActivity({
          organizationId: activityOrgId,
          activityId,
        });
        statusId =
          activity.result?.ethSendTransactionResultV2
            ?.sendTransactionStatusId ??
          activity.result?.ethSendTransactionResult?.sendTransactionStatusId ??
          null;
      } catch {
        // ignore — fall through to "confirmed" fallback
      }

      if (statusId) {
        setApprovalResults((prev) => ({
          ...prev,
          [activityId]: "confirming…",
        }));
        let txHash: string | null = null;
        for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
          try {
            const res = await httpClient.getSendTransactionStatus({
              organizationId: activityOrgId,
              sendTransactionStatusId: statusId,
            });
            if (res.txStatus === "INCLUDED") {
              txHash = res.eth?.txHash ?? null;
              break;
            }
            if (res.txStatus === "FAILED" || res.txError) {
              txHash = `error:${res.error?.message ?? res.txError ?? "Transaction failed"}`;
              break;
            }
          } catch (e) {
            txHash = `error:${e instanceof Error ? e.message : String(e)}`;
            break;
          }
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
        setApprovalResults((prev) => ({
          ...prev,
          [activityId]: txHash ?? "confirmed",
        }));
      } else {
        setApprovalResults((prev) => ({ ...prev, [activityId]: "approved" }));
      }
    } catch (e) {
      console.error("Approval failed:", e);
    } finally {
      setApprovingId(null);
    }
  };

  const isTerminal = (status: string) =>
    [
      "ACTIVITY_STATUS_COMPLETED",
      "ACTIVITY_STATUS_FAILED",
      "ACTIVITY_STATUS_REJECTED",
    ].includes(status);

  if (authState !== AuthState.Authenticated) {
    return <p className="p-6 text-sm text-gray-500">Loading…</p>;
  }

  return (
    <main className="p-6">
      <button
        onClick={() => {
          void logout()
            .then(() => window.location.replace("/"))
            .catch((e) => console.error("Logout failed:", e));
        }}
        className="absolute top-4 right-4 rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
      >
        Logout
      </button>
      <div className="mx-auto max-w-2xl space-y-6 pt-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Test</h1>
          <p className="mt-1 text-sm text-gray-500">
            Run agent CLI commands below, then watch the activity log update in
            real time via SSE.
          </p>
        </div>

        {/* How it works */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">How it works</h2>
          <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-4">
            <li>
              <span className="font-medium text-green-700">Allowed</span> —
              agent signs to{" "}
              <code className="font-mono">
                {process.env.NEXT_PUBLIC_ALLOWED_RECIPIENT ??
                  "ALLOWED_RECIPIENT"}
              </code>{" "}
              freely (Policy A, 1-of-1 consensus). Completes immediately.
            </li>
            <li>
              <span className="font-medium text-yellow-700">
                Approval required
              </span>{" "}
              — agent signs to{" "}
              <code className="font-mono">
                {process.env.NEXT_PUBLIC_APPROVAL_RECIPIENT ??
                  "APPROVAL_RECIPIENT"}
              </code>{" "}
              and the activity sits in{" "}
              <code className="font-mono">CONSENSUS_NEEDED</code> until you
              click Approve below (Policy B, agent + human required).
            </li>
            <li>
              <span className="font-medium text-red-700">Denied</span> — any
              other destination is rejected outright (no matching ALLOW policy).
            </li>
            <li>
              <span className="font-medium text-gray-700">Self-delete</span> —
              agent deletes its own user (Policy C). Run after testing to clean
              up, or to simulate key compromise self-remediation.
            </li>
          </ul>
          {walletAddress && (
            <div className="mt-1 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Fund your wallet with Sepolia ETH before running the agent.{" "}
              <a
                href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Get Sepolia ETH
              </a>
              <br />
              Wallet address:{" "}
              <span className="font-mono break-all">{walletAddress}</span>
            </div>
          )}
        </section>

        {/* CLI commands */}
        {walletAddress && orgId ? (
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Agent CLI commands
            </h2>
            <p className="text-xs text-gray-500">
              Run one of these in a second terminal. The webhook delivers the
              event here via SSE.
            </p>
            <div className="space-y-2">
              <div>
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-green-700">
                  Allowed — completes immediately
                </div>
                <CopyBlock
                  value={`pnpm agent allowed ${walletAddress} ${orgId}`}
                />
              </div>
              <div>
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-yellow-700">
                  Requires approval — approve below
                </div>
                <CopyBlock
                  value={`pnpm agent approval ${walletAddress} ${orgId}`}
                />
              </div>
              <div>
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-red-700">
                  Denied — rejected by policy
                </div>
                <CopyBlock
                  value={`pnpm agent denied ${walletAddress} ${orgId}`}
                />
              </div>
              <div>
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  Self-delete — agent removes itself (policy C)
                </div>
                <CopyBlock
                  value={`pnpm agent self-delete ${walletAddress} ${orgId}`}
                />
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Loading wallet address…</p>
          </section>
        )}

        {/* Activity log */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">
              Activity log
            </h2>
            <span className="text-xs text-gray-400">
              SSE live — {events.length} event{events.length !== 1 && "s"}
            </span>
          </div>

          {events.length === 0 ? (
            <p className="text-xs text-gray-400">
              No events yet. Run an agent command above.
            </p>
          ) : (
            <div
              ref={logRef}
              className="max-h-[28rem] overflow-y-auto space-y-2 pr-1"
            >
              {events.map((ev) => {
                const needsApproval =
                  ev.payload.status === "ACTIVITY_STATUS_CONSENSUS_NEEDED" &&
                  ev.payload.canApprove &&
                  !isTerminal(ev.payload.status) &&
                  !approvalResults[ev.payload.id];

                // Check if a newer event for same activity ID has reached terminal state
                const hasTerminalSibling = events.some(
                  (e) =>
                    e.payload.id === ev.payload.id &&
                    isTerminal(e.payload.status),
                );

                return (
                  <div
                    key={ev.id}
                    className="rounded border border-gray-100 bg-gray-50 p-3 text-xs space-y-1.5"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {statusBadge(ev.payload.status)}
                      <span className="text-gray-400">
                        {new Date(ev.receivedAt).toLocaleTimeString()}
                      </span>
                      {needsApproval && !hasTerminalSibling && (
                        <button
                          onClick={() =>
                            void handleApprove(
                              ev.payload.fingerprint,
                              ev.payload.id,
                              ev.payload.organizationId,
                            )
                          }
                          disabled={approvingId === ev.payload.id}
                          className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {approvingId === ev.payload.id
                            ? "Approving…"
                            : "Approve"}
                        </button>
                      )}
                    </div>
                    <div className="text-gray-500 font-mono break-all">
                      {ev.payload.id}
                    </div>
                    <div className="text-gray-400">
                      {ev.payload.type?.replace("ACTIVITY_TYPE_", "")}
                    </div>
                    {approvalResults[ev.payload.id] &&
                      ev.payload.status !==
                        "ACTIVITY_STATUS_CONSENSUS_NEEDED" && (
                        <div className="font-mono break-all">
                          {approvalResults[ev.payload.id]?.startsWith("0x") ? (
                            <span className="text-green-700">
                              tx:{" "}
                              <a
                                href={`https://sepolia.etherscan.io/tx/${approvalResults[ev.payload.id]}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                              >
                                {approvalResults[ev.payload.id]}
                              </a>
                            </span>
                          ) : approvalResults[ev.payload.id]?.startsWith(
                              "error:",
                            ) ? (
                            <span className="text-red-600">
                              {approvalResults[ev.payload.id]?.slice(6)}
                            </span>
                          ) : (
                            <span className="text-gray-400">
                              {approvalResults[ev.payload.id]}
                            </span>
                          )}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
