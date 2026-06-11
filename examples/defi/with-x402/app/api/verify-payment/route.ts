import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exact } from "x402/schemes";
import { PAYMENT_REQUIREMENTS, COOKIE_TIMEOUT_SECONDS } from "../../constants";

export async function POST(req: Request) {
  try {
    const { paymentHeader } = await req.json();

    if (!paymentHeader) {
      return NextResponse.json(
        { success: false, error: "Payment header is required" },
        { status: 400 },
      );
    }

    // Decode the payment header
    const decodedPayment = exact.evm.decodePayment(paymentHeader);

    const facilitatorUrl =
      process.env.NEXT_PUBLIC_FACILITATOR_URL ||
      "https://www.x402.org/facilitator";

    // Call facilitator to verify
    const verifyResponse = await fetch(`${facilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: decodedPayment,
        paymentRequirements: PAYMENT_REQUIREMENTS,
      }),
    });

    const verifyResult = await verifyResponse.json();

    if (!verifyResult.isValid) {
      return NextResponse.json(
        {
          success: false,
          x402Version: 1,
          error: verifyResult.invalidReason || "Payment verification failed",
          accepts: [PAYMENT_REQUIREMENTS],
          payer: verifyResult.payer,
        },
        { status: 402 }, // Payment Required!
      );
    }

    // Call facilitator to settle the payment
    const settleResponse = await fetch(`${facilitatorUrl}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: decodedPayment,
        paymentRequirements: PAYMENT_REQUIREMENTS,
      }),
    });

    const settleResult = await settleResponse.json();

    if (!settleResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: settleResult.errorReason || "Settle failed",
        },
        { status: 500 },
      );
    }

    // Payment is valid and settled, set the cookie
    const cookieStore = await cookies();
    // This should be a JWT signed by the server following best practices for a session token
    // See: https://nextjs.org/docs/app/guides/authentication#stateless-sessions
    cookieStore.set("payment-session", paymentHeader, {
      maxAge: COOKIE_TIMEOUT_SECONDS, // 5 minutes
    });

    return NextResponse.json(
      {
        success: true,
        payer: verifyResult.payer,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      {
        success: false,
        x402Version: 1,
        error: error instanceof Error ? error.message : "Internal server error",
        accepts: [PAYMENT_REQUIREMENTS],
      },
      { status: 500 },
    );
  }
}
