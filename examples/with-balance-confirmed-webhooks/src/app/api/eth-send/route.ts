import { NextResponse } from "next/server";
import { sendEthTransactionUnsponsored } from "@/lib/turnkey";

export const runtime = "nodejs";

type EthSendRequestBody = {
  from?: string;
  to?: string;
  amountBaseUnits?: string;
  caip2?: string;
  assetType?: "NATIVE" | "ERC20";
  tokenContractAddress?: string;
};

function isHexAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isUnsignedInteger(value: string) {
  return /^\d+$/.test(value);
}

export async function POST(request: Request) {
  let body: EthSendRequestBody;

  try {
    body = (await request.json()) as EthSendRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const from = body.from?.trim() ?? "";
  const to = body.to?.trim() ?? "";
  const amountBaseUnits = body.amountBaseUnits?.trim() ?? "";
  const caip2 = body.caip2?.trim() ?? "";
  const assetType = body.assetType;
  const tokenContractAddress = body.tokenContractAddress?.trim();

  if (!isHexAddress(from)) {
    return NextResponse.json(
      { error: "Invalid `from` address. Expected 0x-prefixed 20-byte hex." },
      { status: 400 },
    );
  }

  if (!isHexAddress(to)) {
    return NextResponse.json(
      { error: "Invalid `to` address. Expected 0x-prefixed 20-byte hex." },
      { status: 400 },
    );
  }

  if (!isUnsignedInteger(amountBaseUnits) || amountBaseUnits === "0") {
    return NextResponse.json(
      { error: "Invalid `amountBaseUnits`. Must be a positive integer string." },
      { status: 400 },
    );
  }

  if (!caip2) {
    return NextResponse.json(
      { error: "Missing `caip2` network." },
      { status: 400 },
    );
  }

  if (assetType !== "NATIVE" && assetType !== "ERC20") {
    return NextResponse.json(
      { error: "Invalid `assetType`. Use `NATIVE` or `ERC20`." },
      { status: 400 },
    );
  }

  if (assetType === "ERC20" && !isHexAddress(tokenContractAddress ?? "")) {
    return NextResponse.json(
      {
        error:
          "Invalid `tokenContractAddress`. ERC20 transfers require a valid 0x contract address.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await sendEthTransactionUnsponsored({
      from,
      to,
      amountBaseUnits,
      caip2,
      assetType,
      tokenContractAddress,
    });

    return NextResponse.json({
      ok: true,
      from,
      to,
      amountBaseUnits,
      caip2,
      assetType,
      tokenContractAddress,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send transaction",
      },
      { status: 500 },
    );
  }
}
