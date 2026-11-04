import { NextResponse } from "next/server";
import type { TxStatusWebhookPayload } from "@/lib/types";
import { getTxStatusWebhookEventStore } from "@/lib/webhook-events";

export const runtime = "nodejs";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTxStatusWebhookPayload(
  value: unknown,
): value is TxStatusWebhookPayload {
  if (!isObject(value)) {
    return false;
  }

  if (typeof value.type !== "string") {
    return false;
  }

  if (!isObject(value.msg)) {
    return false;
  }

  return true;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON payload", details: String(error) },
      { status: 400 },
    );
  }

  if (!isTxStatusWebhookPayload(payload)) {
    return NextResponse.json(
      { error: "Payload must contain `type` and `msg` fields." },
      { status: 400 },
    );
  }

  const event = getTxStatusWebhookEventStore().addEvent(payload);

  return NextResponse.json({
    ok: true,
    eventId: event.id,
    receivedAt: event.receivedAt,
  });
}

export function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "Send SEND_TRANSACTION_STATUS_UPDATES webhooks to this endpoint with POST requests.",
  });
}
