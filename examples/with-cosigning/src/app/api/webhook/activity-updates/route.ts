import { NextResponse } from "next/server";
import { getActivityEventStore } from "@/lib/activity-events";
import type { ActivityWebhookPayload } from "@/lib/types";

export const runtime = "nodejs";

function isActivityWebhookPayload(
  value: unknown,
): value is ActivityWebhookPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === "string" &&
    typeof (value as Record<string, unknown>).organizationId === "string" &&
    typeof (value as Record<string, unknown>).status === "string" &&
    typeof (value as Record<string, unknown>).type === "string" &&
    typeof (value as Record<string, unknown>).fingerprint === "string"
  );
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  if (!isActivityWebhookPayload(payload)) {
    return NextResponse.json(
      {
        error:
          "Payload must contain id, organizationId, status, and fingerprint fields.",
      },
      { status: 400 },
    );
  }

  // Ignore activities from the parent org (e.g. OTP_LOGIN, CREATE_SUB_ORGANIZATION).
  // Only sub-org activities (sign requests awaiting cosigner approval) are relevant here.
  // Note: Turnkey will soon support server-side filtering via the `filtersJson` field on
  // webhook subscriptions, which will make this client-side check unnecessary.
  if (payload.organizationId === process.env.NEXT_PUBLIC_ORGANIZATION_ID) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (payload.status === "ACTIVITY_STATUS_CONSENSUS_NEEDED") {
    console.log(
      `[webhook] Activity ${payload.id} needs cosigner approval.\n` +
        `  Run: pnpm cosign ${payload.id} ${payload.organizationId}`,
    );
  }

  const event = getActivityEventStore().addEvent(payload, false);

  return NextResponse.json({ ok: true, eventId: event.id });
}

export function GET() {
  return NextResponse.json({
    ok: true,
    message: "Send ACTIVITY_UPDATES webhooks to this endpoint via POST.",
  });
}
