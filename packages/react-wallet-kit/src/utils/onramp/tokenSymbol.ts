import type { OnRampCaip19, OnRampCaip2, v1AssetMetadata } from "@turnkey/core";

export function caip2Of(token: OnRampCaip19): OnRampCaip2 {
  return token.slice(0, token.indexOf("/")) as OnRampCaip2;
}

function fallbackTokenSymbol(token: OnRampCaip19): string {
  if (token.endsWith("slip44:60")) return "ETH";
  if (token.endsWith("slip44:501")) return "SOL";
  if (token.includes("0x7ceb23fd6bc0add59e62ac25578270cff1b9f619")) {
    return "WETH";
  }
  return "USDC";
}

export function tokenMetadata(
  token: OnRampCaip19,
  assetsByCaip2: Record<string, v1AssetMetadata[]>,
): v1AssetMetadata | undefined {
  return assetsByCaip2[caip2Of(token)]?.find((asset) => asset.caip19 === token);
}

export function tokenSymbol(
  token: OnRampCaip19,
  assetsByCaip2: Record<string, v1AssetMetadata[]>,
) {
  return (
    tokenMetadata(token, assetsByCaip2)?.symbol || fallbackTokenSymbol(token)
  );
}

export function tokenDecimals(
  token: OnRampCaip19,
  assetsByCaip2: Record<string, v1AssetMetadata[]>,
): number {
  return tokenMetadata(token, assetsByCaip2)?.decimals ?? 6;
}
