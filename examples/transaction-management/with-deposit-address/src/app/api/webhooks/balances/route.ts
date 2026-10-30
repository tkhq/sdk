import { NextResponse } from "next/server";
import { BASE_SEPOLIA_CAIP2, sweepAssetOf } from "@/lib/deposit";
import { serverEnv } from "@/server/env";
import { findDepositAddress } from "@/server/registry";
import { queueSweep } from "@/server/sweep";
import {
  firstDelivery,
  parseConfirmedDeposit,
  verifyWebhook,
} from "@/server/webhook";

export const runtime = "nodejs";

// Receives BALANCE_CONFIRMED_UPDATES deliveries for the parent organization.
// Turnkey treats any 4xx as final and retries 5xx, so answer fast and only
// return an error for a delivery that should never be retried.
export async function POST(request: Request) {
  const rawBody = await request.text();

  const verified = await verifyWebhook(request.headers, rawBody);
  if (!verified.ok) {
    console.warn(`[webhook] rejected: ${verified.reason}`);
    return NextResponse.json({ error: verified.reason }, { status: 401 });
  }

  if (!firstDelivery(verified.eventId)) {
    console.log(`[webhook] ${verified.eventId} duplicate, ignored`);
    return NextResponse.json({ ok: true, duplicate: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const deposit = parseConfirmedDeposit(payload);
  if (!deposit) {
    return NextResponse.json({ ok: true, ignored: "not a confirmed deposit" });
  }
  if (deposit.caip2 !== BASE_SEPOLIA_CAIP2) {
    console.log(`[webhook] ${verified.eventId} on ${deposit.caip2}, ignored`);
    return NextResponse.json({ ok: true, ignored: "wrong chain" });
  }

  const entry = await findDepositAddress(deposit.address);
  if (!entry) {
    console.log(
      `[webhook] ${verified.eventId} ${deposit.address} is not an enabled deposit address`,
    );
    return NextResponse.json({ ok: true, ignored: "unknown address" });
  }
  if (entry.subOrgId !== deposit.subOrgId) {
    console.error(
      `[webhook] ${verified.eventId} sub-org mismatch for ${entry.address}: ` +
        `registry ${entry.subOrgId}, event ${deposit.subOrgId}. Not sweeping.`,
    );
    return NextResponse.json({ ok: true, ignored: "sub-org mismatch" });
  }

  console.log(
    `[webhook] ${verified.eventId} deposit ${deposit.amount} ${deposit.symbol} ` +
      `to ${entry.address} (sub-org ${entry.subOrgId}) tx ${deposit.txHash}`,
  );

  const asset = sweepAssetOf(deposit.caip19);
  if (!asset) {
    console.log(`[webhook] ${verified.eventId} ${deposit.caip19} not swept`);
    return NextResponse.json({ ok: true, ignored: "unsupported asset" });
  }
  if (!serverEnv.sweepEnabled) {
    console.log(`[webhook] ${verified.eventId} SWEEP_ENABLED=false, left`);
    return NextResponse.json({ ok: true, ignored: "sweeps paused" });
  }

  // Runs in the background so Turnkey gets its 2xx right away.
  queueSweep({
    eventId: verified.eventId,
    entry,
    asset,
    depositTxHash: deposit.txHash,
  });
  return NextResponse.json({ ok: true, sweep: "queued" });
}
