import { WalletConnectPay } from "@walletconnect/pay";

const WC_API_KEY = process.env.EXPO_PUBLIC_WC_API_KEY || "";

// Singleton WalletConnect Pay client
let wcPayClient: WalletConnectPay | null = null;

export function getWcPayClient(): WalletConnectPay {
  if (!wcPayClient) {
    wcPayClient = new WalletConnectPay({
      apiKey: WC_API_KEY,
    });
  }
  return wcPayClient;
}

/**
 * Normalize WC Pay URLs. The dashboard test flow generates URLs with a ?pid=
 * query param (sometimes with backslash escapes), but the SDK expects the
 * payment ID in the path.
 *
 *   ?pid=pay_XXX  →  /pay_XXX
 *   /pay_XXX      →  /pay_XXX (unchanged)
 */
export function normalizePaymentLink(link: string): string {
  // Remove any backslash escapes
  let cleaned = link.replace(/\\/g, "");

  // If URL has ?pid= query param, extract and convert to path format
  const pidMatch = cleaned.match(/[?&]pid=([^&]+)/);
  if (pidMatch) {
    return "https://pay.walletconnect.com/" + pidMatch[1];
  }

  return cleaned;
}

// Base mainnet chain ID in CAIP-2 format
export const BASE_CHAIN_ID = "eip155:8453";

// Build CAIP-10 accounts array for a given wallet address
export function buildAccounts(walletAddress: string): string[] {
  return [
    `eip155:1:${walletAddress}`, // Ethereum mainnet
    `eip155:8453:${walletAddress}`, // Base
    `eip155:10:${walletAddress}`, // Optimism
    `eip155:137:${walletAddress}`, // Polygon
    `eip155:42161:${walletAddress}`, // Arbitrum
  ];
}
