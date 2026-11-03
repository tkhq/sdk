import { NextResponse } from "next/server";
import { getBalances } from "@/lib/turnkey";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const address = searchParams.get("address")?.trim();
  const caip2 = searchParams.get("caip2")?.trim();

  if (!address || !caip2) {
    return NextResponse.json(
      { error: "Missing required query params: address and caip2" },
      { status: 400 },
    );
  }

  try {
    const balances = await getBalances({ address, caip2 });
    return NextResponse.json({ address, caip2, balances });
  } catch (error) {
    console.error("Failed to fetch balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch balances from Turnkey" },
      { status: 500 },
    );
  }
}
