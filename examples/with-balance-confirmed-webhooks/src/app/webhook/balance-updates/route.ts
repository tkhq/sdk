import { NextResponse } from "next/server";
import { BalanceConfirmedWebhookPayload } from "@/lib/types";
import { getBalanceWebhookEventStore } from "@/lib/webhook-events";

export const runtime = "nodejs";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBalanceConfirmedWebhookPayload(
  value: unknown,
): value is BalanceConfirmedWebhookPayload {
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

  if (!isBalanceConfirmedWebhookPayload(payload)) {
    return NextResponse.json(
      { error: "Payload must contain `type` and `msg` fields." },
      { status: 400 },
    );
  }

  const event = getBalanceWebhookEventStore().addEvent(payload);

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
      "Send BALANCE_CONFIRMED_UPDATES webhooks to this endpoint with POST requests.",
  });
}
