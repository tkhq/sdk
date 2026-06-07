import { NextResponse } from "next/server";
import { runDelegatedReclaim } from "@/server/actions/runDelegatedReclaim";
import { env } from "@/env";

export const dynamic = "force-dynamic";

// Production entry point for automated reclaim.
// Wire to a scheduler (Vercel cron, GitHub Actions, etc.) to sweep expired unclaimed links.
export async function POST(req: Request) {
  if (env.CRON_SECRET) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const report = await runDelegatedReclaim();
  return NextResponse.json(report);
}
