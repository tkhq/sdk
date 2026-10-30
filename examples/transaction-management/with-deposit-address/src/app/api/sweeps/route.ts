import { NextResponse } from "next/server";
import { parseAddress } from "@/lib/deposit";
import { sweepsFor } from "@/server/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sweep history for one deposit address, polled by the dashboard. Everything
// here is already public onchain, so the demo does not authenticate it.
export function GET(request: Request) {
  const address = parseAddress(
    new URL(request.url).searchParams.get("address") ?? undefined,
  );
  if (!address) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }
  return NextResponse.json({ sweeps: sweepsFor(address) });
}
