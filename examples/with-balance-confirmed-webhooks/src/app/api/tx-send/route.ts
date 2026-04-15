import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { sendAssetTransactionUnsponsored } from "@/lib/turnkey";

export const runtime = "nodejs";

type SendRequestBody = {
  from?: string;
  to?: string;
  amountBaseUnits?: string;
  caip2?: string;
  assetType?: "NATIVE" | "ERC20" | "SPL";
  tokenContractAddress?: string;
  tokenMintAddress?: string;
};

function isHexAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isSolanaAddress(value: string) {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function isUnsignedInteger(value: string) {
  return /^\d+$/.test(value);
}

export async function POST(request: Request) {
  let body: SendRequestBody;

  try {
    body = (await request.json()) as SendRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const from = body.from?.trim() ?? "";
  const to = body.to?.trim() ?? "";
  const amountBaseUnits = body.amountBaseUnits?.trim() ?? "";
  const caip2 = body.caip2?.trim() ?? "";
  const assetType = body.assetType;
  const tokenContractAddress = body.tokenContractAddress?.trim();
  const tokenMintAddress = body.tokenMintAddress?.trim();
  const isEvmNetwork = caip2.startsWith("eip155:");
  const isSvmNetwork = caip2.startsWith("solana:");

  if (!caip2) {
    return NextResponse.json(
      { error: "Missing `caip2` network." },
      { status: 400 },
    );
  }

  if (!isEvmNetwork && !isSvmNetwork) {
    return NextResponse.json(
      { error: "Unsupported `caip2`. Use an EVM or Solana CAIP-2 value." },
      { status: 400 },
    );
  }

  if (isEvmNetwork && !isHexAddress(from)) {
    return NextResponse.json(
      { error: "Invalid `from` address. Expected 0x-prefixed 20-byte hex." },
      { status: 400 },
    );
  }

  if (isEvmNetwork && !isHexAddress(to)) {
    return NextResponse.json(
      { error: "Invalid `to` address. Expected 0x-prefixed 20-byte hex." },
      { status: 400 },
    );
  }

  if (isSvmNetwork && !isSolanaAddress(from)) {
    return NextResponse.json(
      { error: "Invalid `from` address. Expected a base58 Solana address." },
      { status: 400 },
    );
  }

  if (isSvmNetwork && !isSolanaAddress(to)) {
    return NextResponse.json(
      { error: "Invalid `to` address. Expected a base58 Solana address." },
      { status: 400 },
    );
  }

  if (!isUnsignedInteger(amountBaseUnits) || amountBaseUnits === "0") {
    return NextResponse.json(
      {
        error: "Invalid `amountBaseUnits`. Must be a positive integer string.",
      },
      { status: 400 },
    );
  }

  if (assetType !== "NATIVE" && assetType !== "ERC20" && assetType !== "SPL") {
    return NextResponse.json(
      { error: "Invalid `assetType`. Use `NATIVE`, `ERC20`, or `SPL`." },
      { status: 400 },
    );
  }

  if (isEvmNetwork && assetType === "SPL") {
    return NextResponse.json(
      { error: "Use `ERC20` or `NATIVE` for EVM networks." },
      { status: 400 },
    );
  }

  if (isSvmNetwork && assetType === "ERC20") {
    return NextResponse.json(
      { error: "Use `SPL` or `NATIVE` for Solana networks." },
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

  if (assetType === "SPL" && !isSolanaAddress(tokenMintAddress ?? "")) {
    return NextResponse.json(
      {
        error:
          "Invalid `tokenMintAddress`. SPL transfers require a valid Solana mint address.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await sendAssetTransactionUnsponsored({
      from,
      to,
      amountBaseUnits,
      caip2,
      assetType,
      tokenContractAddress,
      tokenMintAddress,
    });

    return NextResponse.json({
      ok: true,
      from,
      to,
      amountBaseUnits,
      caip2,
      assetType,
      tokenContractAddress,
      tokenMintAddress,
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
