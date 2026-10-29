import type { OnRampCaip19, v1FiatRampProvider } from "@turnkey/core";
import { toAtomicAmount } from "./buildCryptoTransfer";
import { solanaRpcUrl } from "./sendCryptoTransfer";
import { assetOf, caip2Of } from "./tokenSymbol";

const SEPOLIA = "eip155:11155111";
const SOLANA_DEVNET = "solana:devnet";
// MoonPay's Sepolia ERC-20. Sandbox sells of USDC and other tokens deliver this, not the real token. 18 decimals.
const MOONPAY_TOKEN = "0x699cfe8997d647d03325ef4bfd039d5bb0984a17";
const POLYGON_ETH =
  "eip155:137/erc20:0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";

export type DepositPlan =
  | {
      mode: "send";
      caip2: string;
      asset: string;
      symbol: string;
      amount: string;
      atomicAmount: string;
      rpcUrl?: string | undefined;
    }
  | {
      mode: "hold";
      title: string;
      instructions: string;
      complete: boolean;
    };

export function depositPlan(params: {
  token: OnRampCaip19;
  amount: string;
  atomicAmount: string;
  provider: v1FiatRampProvider;
  sandboxMode: boolean;
  rpcUrl?: string | undefined;
  symbol: string;
}): DepositPlan {
  const { token, amount, provider, symbol } = params;
  const quotedCaip2 = caip2Of(token);

  if (!params.sandboxMode) {
    return sendPlan({
      caip2: quotedCaip2,
      asset: assetOf(token),
      symbol,
      amount,
      atomicAmount: params.atomicAmount,
      rpcUrl: solanaRpcUrl(quotedCaip2, params.rpcUrl),
    });
  }

  if (provider === "FIAT_RAMP_PROVIDER_COINBASE") {
    return {
      mode: "hold",
      complete: false,
      title: "Coinbase offramp is live only",
      instructions: "Turn sandbox mode off to sell through Coinbase.",
    };
  }

  if (quotedCaip2.startsWith("solana:")) {
    if (assetOf(token).startsWith("token:")) {
      return {
        mode: "hold",
        complete: false,
        title: "Solana devnet does not support this token",
        instructions:
          "MoonPay sandbox accepts native SOL on Solana devnet. SPL tokens such as USDC are only available when sandbox mode is off.",
      };
    }
    return sendPlan({
      caip2: SOLANA_DEVNET,
      asset: "slip44:501",
      symbol: "SOL",
      amount,
      atomicAmount: params.atomicAmount,
      rpcUrl: solanaRpcUrl(SOLANA_DEVNET, params.rpcUrl),
    });
  }

  if (isQuotedEth(token)) {
    return sendPlan({
      caip2: SEPOLIA,
      asset: "slip44:60",
      symbol: "ETH",
      amount,
      atomicAmount: params.atomicAmount,
    });
  }

  const tokenAmount = toAtomicAmount(amount, 18);
  if (tokenAmount === undefined) {
    return {
      mode: "hold",
      complete: false,
      title: "Unable to price this sandbox deposit",
      instructions:
        "MoonPay sandbox delivers its Sepolia test token, MoonPayToken, instead of the quoted asset. Enter the amount again and retry.",
    };
  }

  return sendPlan({
    caip2: SEPOLIA,
    asset: `erc20:${MOONPAY_TOKEN}`,
    symbol: "MPT",
    amount,
    atomicAmount: tokenAmount.toString(),
  });
}

export function applyReturnedAmount(
  plan: DepositPlan,
  returned: string | undefined,
): DepositPlan {
  if (plan.mode !== "send" || !returned) return plan;
  const atomic = toAtomicAmount(returned, decimalsForAsset(plan.asset));
  if (atomic === undefined || atomic <= 0n) return plan;
  return sendPlan({
    caip2: plan.caip2,
    asset: plan.asset,
    symbol: plan.symbol,
    amount: returned,
    atomicAmount: atomic.toString(),
    rpcUrl: plan.rpcUrl,
  });
}

export function isDepositAddress(caip2: string, value: string) {
  if (caip2.startsWith("eip155:")) return /^0x[0-9a-fA-F]{40}$/.test(value);
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

export function positiveAtomic(value: string) {
  return /^\d+$/.test(value) && BigInt(value) > 0n;
}

function decimalsForAsset(asset: string) {
  const normalized = asset.toLowerCase();
  if (
    normalized === "slip44:60" ||
    normalized === `erc20:${MOONPAY_TOKEN}` ||
    normalized.includes("0x7ceb23fd6bc0add59e62ac25578270cff1b9f619")
  ) {
    return 18;
  }
  if (normalized === "slip44:501") return 9;
  return 6;
}

function sendPlan(params: {
  caip2: string;
  asset: string;
  symbol: string;
  amount: string;
  atomicAmount: string;
  rpcUrl?: string | undefined;
}): DepositPlan {
  return { mode: "send", ...params };
}

function isQuotedEth(token: OnRampCaip19) {
  return token.endsWith("/slip44:60") || token.toLowerCase() === POLYGON_ETH;
}
