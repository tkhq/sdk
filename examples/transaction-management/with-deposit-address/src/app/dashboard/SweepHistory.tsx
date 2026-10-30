"use client";

import { useEffect, useState } from "react";
import { formatUnits, type Address } from "viem";

import { BASE_SEPOLIA_EXPLORER, USDC_DECIMALS } from "@/lib/deposit";
import type { SweepRecord } from "@/server/sweep";

const POLL_MS = 3000;

const STATUS_STYLE: Record<SweepRecord["status"], string> = {
  pending: "text-gray-600",
  submitted: "text-blue-700",
  swept: "text-emerald-700",
  skipped: "text-gray-500",
  failed: "text-red-700",
};

function TxLink({ hash }: { hash: string }) {
  return (
    <a
      href={`${BASE_SEPOLIA_EXPLORER}/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-blue-700 hover:underline break-all"
    >
      {hash}
    </a>
  );
}

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
      <p className="text-xs text-gray-500">
        No deposits yet. Sweeps appear here within a few seconds of the deposit
        confirming.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sweeps.map((s) => (
        <li
          key={s.eventId}
          className="p-3 border rounded bg-gray-50 text-xs space-y-1"
        >
          <div className="flex justify-between">
            <span className="font-medium">
              {s.amount
                ? formatUnits(
                    BigInt(s.amount),
                    s.asset === "USDC" ? USDC_DECIMALS : 18,
                  )
                : ""}{" "}
              {s.asset}
            </span>
            <span className={`font-semibold ${STATUS_STYLE[s.status]}`}>
              {s.status}
            </span>
          </div>
          <div>
            Deposit: <TxLink hash={s.depositTxHash} />
          </div>
          {s.txHash && (
            <div>
              Sweep: <TxLink hash={s.txHash} />
            </div>
          )}
          {s.detail && <div className="text-gray-600">{s.detail}</div>}
        </li>
      ))}
    </ul>
  );
}
