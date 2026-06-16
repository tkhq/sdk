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
import { getActivityAction } from "@/server/actions/turnkey";

function CopyBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="flex items-center gap-2 rounded border border-yellow-200 bg-white px-3 py-2">
      <code className="flex-1 font-mono text-[11px] text-gray-800 break-all">
        {value}
      </code>
      <button
        onClick={copy}
        className="shrink-0 rounded bg-yellow-100 px-2 py-1 text-[10px] font-medium text-yellow-800 hover:bg-yellow-200"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

type SignStatus =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "pending"; activityId: string; orgId: string }
  | { kind: "completed"; signature: string; activityId: string }
  | { kind: "error"; message: string };

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

export default function Dashboard() {
  const router = useRouter();
  const { authState, logout, session, wallets } = useTurnkey();
  const { httpClient } = useTurnkey();

  useEffect(() => {
    if (authState === AuthState.Unauthenticated) router.replace("/");
  }, [authState, router]);

  // First ETH wallet account
  const walletAddress = useMemo(() => {
    return (
      (wallets ?? [])
        .filter((w: Wallet) => w.source === WalletSource.Embedded)
        .flatMap((w) => w.accounts ?? [])
        .find((a) => a.addressFormat?.includes("ETHEREUM"))?.address ?? null
    );
  }, [wallets]);

  // --- Sign state ---
  const [message, setMessage] = useState("Hello from Turnkey Co-Signing!");
  const [signStatus, setSignStatus] = useState<SignStatus>({ kind: "idle" });
  // Track activity IDs the current user submitted so we don't show Approve on their own pending activities
  const userInitiatedIds = useRef(new Set<string>());

  const handleSign = async () => {
    if (!httpClient) return;
    if (!walletAddress) {
      setSignStatus({ kind: "error", message: "No Ethereum wallet found." });
      return;
    }
    if (!session?.organizationId) {
      setSignStatus({ kind: "error", message: "Not authenticated." });
      return;
    }

    setSignStatus({ kind: "signing" });

    try {
      const payload =
        "0x" + Buffer.from(message || "Co-signing demo").toString("hex");

      // The SDK automatically polls getActivity after submitting (default: 3×, 1s apart)
      // waiting for a terminal status (COMPLETED / FAILED). With a 2-of-2 quorum the
      // activity sits in CONSENSUS_NEEDED — never terminal — so polling exhausts and the
      // SDK returns the raw activity response with status CONSENSUS_NEEDED instead.
      const res = await httpClient.signRawPayload({
        organizationId: session.organizationId,
        signWith: walletAddress,
        payload,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_SHA256",
      });

      const activityStatus = (res as any).activity?.status as
        | string
        | undefined;
      const activityId = (res as any).activity?.id as string | undefined;

      if (activityStatus === "ACTIVITY_STATUS_CONSENSUS_NEEDED" && activityId) {
        userInitiatedIds.current.add(activityId);
        setSignStatus({
          kind: "pending",
          activityId,
          orgId: session.organizationId,
        });
      } else if (activityStatus === "ACTIVITY_STATUS_COMPLETED") {
        const r = (res as any).r ?? "";
        const s = (res as any).s ?? "";
        const v = (res as any).v ?? "";
        setSignStatus({
          kind: "completed",
          signature: `0x${r}${s}${v}`,
          activityId: activityId ?? "",
        });
      } else {
        setSignStatus({
          kind: "error",
          message: `Unexpected activity status: ${activityStatus ?? "unknown"}`,
        });
      }
    } catch (e: unknown) {
      setSignStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Signing failed.",
      });
    }
  };

  // --- SSE listener: auto-completes pending sign when cosigner approves ---
  useEffect(() => {
    if (signStatus.kind !== "pending") return;

    const { activityId, orgId } = signStatus;
    const es = new EventSource("/api/events");

    const handleMessage = async (e: MessageEvent) => {
      let msg: ActivitySseMessage;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      if (msg.type === "connected") {
        // Check recent events in case approval already happened
        for (const event of msg.recentEvents) {
          await checkEvent(event, activityId, orgId);
        }
      } else if (msg.type === "activity-update") {
        await checkEvent(msg.event, activityId, orgId);
      }
    };

    const checkEvent = async (
      event: ActivityEventEnvelope,
      targetId: string,
      orgId: string,
    ) => {
      if (event.payload.id !== targetId) return;
      if (event.payload.status === "ACTIVITY_STATUS_COMPLETED") {
        // Fetch full activity to get the signature result
        try {
          const activity = await getActivityAction({
            organizationId: orgId,
            activityId: targetId,
          });
          const result = (activity as any).result?.signRawPayloadResult;
          const sig = result
            ? `0x${result.r ?? ""}${result.s ?? ""}${result.v ?? ""}`
            : "(no signature in result)";
          setSignStatus({
            kind: "completed",
            signature: sig,
            activityId: targetId,
          });
        } catch {
          setSignStatus({
            kind: "completed",
            signature: "(activity completed — fetch signature via getActivity)",
            activityId: targetId,
          });
        }
      } else if (
        event.payload.status === "ACTIVITY_STATUS_FAILED" ||
        event.payload.status === "ACTIVITY_STATUS_REJECTED"
      ) {
        setSignStatus({
          kind: "error",
          message: `Activity ${event.payload.status.replace("ACTIVITY_STATUS_", "")}`,
        });
      }
    };

    es.addEventListener("message", handleMessage);
    es.onerror = () => es.close();

    return () => {
      es.removeEventListener("message", handleMessage);
      es.close();
    };
  }, [signStatus]);

  // --- User-side approval of backend-initiated activities ---
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const handleApprove = async (fingerprint: string, activityId: string) => {
    if (!httpClient) return;
    setApprovingId(activityId);
    try {
      await httpClient.approveActivity({ fingerprint });
    } catch (e) {
      console.error("Approval failed:", e);
    } finally {
      setApprovingId(null);
    }
  };

  // --- Webhook event log ---
  const [events, setEvents] = useState<ActivityEventEnvelope[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.addEventListener("message", (e: MessageEvent) => {
      let msg: ActivitySseMessage;
      try {
        msg = JSON.parse(e.data);
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

  const handleLogout = async () => {
    try {
      await logout();
      window.location.replace("/");
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  if (authState !== AuthState.Authenticated) {
    return <p className="p-6 text-sm text-gray-500">Loading…</p>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
      >
        Logout
      </button>

      <div className="mx-auto max-w-3xl space-y-6 pt-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            2-of-2 Co-Signing Demo
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Your key signs first, the backend cosigner approves via webhook.
          </p>
        </div>

        {/* Org info */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-1">
          <div className="text-xs text-gray-400">Sub-org ID</div>
          <div className="text-xs font-mono break-all text-gray-700">
            {session?.organizationId ?? "—"}
          </div>
          <div className="mt-2 text-xs text-gray-400">Signing wallet</div>
          <div className="text-xs font-mono break-all text-gray-700">
            {walletAddress ?? "(loading…)"}
          </div>
          {walletAddress && session?.organizationId && (
            <div className="mt-3 space-y-1">
              <div className="text-xs text-gray-400">
                To trigger the reverse flow (backend signs first, you approve):
              </div>
              <CopyBlock
                value={`pnpm sign ${walletAddress} ${session.organizationId}`}
              />
            </div>
          )}
        </section>

        {/* Sign message */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">
            Sign a message
          </h2>
          <p className="text-xs text-gray-500">
            Your session key signs first (vote 1 of 2). The activity lands in{" "}
            <span className="font-mono">CONSENSUS_NEEDED</span>. Copy the
            command below and run it in a second terminal to simulate the
            backend cosigner approving (vote 2 of 2).
          </p>

          <label className="block text-sm font-medium text-gray-700">
            Message
            <textarea
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={
                signStatus.kind === "signing" || signStatus.kind === "pending"
              }
            />
          </label>

          <button
            onClick={() => {
              setSignStatus({ kind: "idle" });
              handleSign();
            }}
            disabled={
              signStatus.kind === "signing" ||
              signStatus.kind === "pending" ||
              !walletAddress
            }
            className="rounded bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {signStatus.kind === "signing"
              ? "Signing…"
              : signStatus.kind === "pending"
                ? "Waiting for cosigner…"
                : "Sign message"}
          </button>

          {/* Status display */}
          {signStatus.kind === "pending" && (
            <div className="rounded border border-yellow-300 bg-yellow-50 p-4 text-xs space-y-3">
              <div className="font-medium text-yellow-800">
                Waiting for cosigner approval — run this in a second terminal:
              </div>
              <CopyBlock
                value={`pnpm cosign ${signStatus.activityId} ${signStatus.orgId}`}
              />
              <div className="text-yellow-700 space-y-0.5">
                <div>
                  <span className="text-yellow-500">Activity ID: </span>
                  <span className="font-mono">{signStatus.activityId}</span>
                </div>
                <div>
                  <span className="text-yellow-500">Sub-org ID: </span>
                  <span className="font-mono">{signStatus.orgId}</span>
                </div>
              </div>
            </div>
          )}

          {signStatus.kind === "completed" && (
            <div className="rounded border border-green-300 bg-green-50 p-3 text-xs space-y-1">
              <div className="font-medium text-green-800">
                Both parties signed — activity complete!
              </div>
              <div className="text-gray-500">Signature:</div>
              <pre className="font-mono break-all whitespace-pre-wrap text-green-900">
                {signStatus.signature}
              </pre>
            </div>
          )}

          {signStatus.kind === "error" && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-700">
              {signStatus.message}
            </div>
          )}
        </section>

        {/* Webhook event log */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">
              Activity webhook events
            </h2>
            <span className="text-xs text-gray-400">
              SSE live — last {events.length} event{events.length !== 1 && "s"}
            </span>
          </div>

          {events.length === 0 ? (
            <p className="text-xs text-gray-400">
              No events yet. Sign a message above.
            </p>
          ) : (
            <div
              ref={logRef}
              className="max-h-72 overflow-y-auto space-y-2 pr-1"
            >
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded border border-gray-100 bg-gray-50 p-3 text-xs space-y-1"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusBadge(ev.payload.status)}
                    {ev.approved && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                        cosigner approved
                      </span>
                    )}
                    <span className="text-gray-400">
                      {new Date(ev.receivedAt).toLocaleTimeString()}
                    </span>
                    {ev.payload.status === "ACTIVITY_STATUS_CONSENSUS_NEEDED" &&
                      ev.payload.fingerprint &&
                      !userInitiatedIds.current.has(ev.payload.id) &&
                      !events.some(
                        (e) =>
                          e.payload.id === ev.payload.id &&
                          [
                            "ACTIVITY_STATUS_COMPLETED",
                            "ACTIVITY_STATUS_FAILED",
                            "ACTIVITY_STATUS_REJECTED",
                          ].includes(e.payload.status),
                      ) && (
                        <button
                          onClick={() =>
                            handleApprove(ev.payload.fingerprint, ev.payload.id)
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
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
