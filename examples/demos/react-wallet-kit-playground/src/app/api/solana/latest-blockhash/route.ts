import { NextResponse } from "next/server";

const DEFAULT_SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";

export async function GET() {
  const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_SOLANA_RPC_URL;

  const rpcResponse = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "latest-blockhash",
      method: "getLatestBlockhash",
      params: [{ commitment: "confirmed" }],
    }),
    cache: "no-store",
  });

  if (!rpcResponse.ok) {
    return NextResponse.json(
      {
        error: `Upstream RPC returned ${rpcResponse.status}`,
      },
      { status: 502 },
    );
  }

  const payload = (await rpcResponse.json()) as {
    result?: { value?: { blockhash?: string } };
    error?: unknown;
  };

  if (payload.error || !payload.result?.value?.blockhash) {
    return NextResponse.json(
      {
        error: "Failed to fetch latest blockhash from RPC",
        details: payload.error ?? null,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ blockhash: payload.result.value.blockhash });
}
