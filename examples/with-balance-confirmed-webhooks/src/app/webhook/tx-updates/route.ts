import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

  console.log("Received webhook payload:", payload);

  return NextResponse.json({
    ok: true,
  });
}

export function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "Send SEND_TRANSACTION_STATUS_UPDATES webhooks to this endpoint with POST requests.",
  });
}
