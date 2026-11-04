"use client";

import { useEffect, useState } from "react";
import { formatUnits, type Address } from "viem";

import { USDC_DECIMALS } from "@/lib/deposit";
import type { SweepRecord } from "@/server/sweep";
import { TxLink } from "./ui";

const POLL_MS = 3000;

const STATUS_STYLE: Record<SweepRecord["status"], string> = {
  pending: "bg-slate-100 text-slate-600",
  submitted: "bg-blue-50 text-blue-700",
  swept: "bg-emerald-50 text-emerald-700",
  skipped: "bg-slate-100 text-slate-500",
  failed: "bg-red-50 text-red-700",
};

// Polls the server for sweeps of this address. The webhook drives the sweep;
// this panel only shows what happened.
export function SweepHistory({ address }: { address: Address }) {
  const [sweeps, setSweeps] = useState<SweepRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/sweeps?address=${address}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body: { sweeps: SweepRecord[] } = await res.json();
        if (!cancelled) setSweeps(body.sweeps);
      } catch {
        // Keep the last result; the next poll will try again.
      }
    };
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [address]);

  if (sweeps.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Nothing yet. A sweep appears here a few seconds after a deposit
        confirms.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {sweeps.map((s) => (
        <li key={s.eventId} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              {s.amount
                ? formatUnits(
                    BigInt(s.amount),
                    s.asset === "USDC" ? USDC_DECIMALS : 18,
                  )
                : ""}{" "}
              {s.asset}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}
            >
              {s.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>
              Deposit <TxLink hash={s.depositTxHash} />
            </span>
            {s.txHash && (
              <span>
                Sweep <TxLink hash={s.txHash} />
              </span>
            )}
          </div>
          {s.detail && (
            <p className="text-xs break-words text-slate-600">{s.detail}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
