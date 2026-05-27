export interface BalanceWebhookAsset {
  symbol?: string;
  name?: string;
  decimals?: number;
  caip19?: string;
  amount?: string;
}

export interface BalanceWebhookBlock {
  number?: number;
  hash?: string;
  timestamp?: string;
}

export interface BalanceWebhookMessage extends Record<string, unknown> {
  operation?: string;
  caip2?: string;
  txHash?: string;
  address?: string;
  orgID?: string;
  parentOrgID?: string;
  idempotencyKey?: string;
  asset?: BalanceWebhookAsset;
  block?: BalanceWebhookBlock;
}

export interface BalanceUpdateWebhookPayload {
  type: string;
  msg: BalanceWebhookMessage;
}

export type BalanceWebhookPhase = "confirmed" | "finalized" | "unknown";

export function getBalanceWebhookPhase(
  payload: BalanceUpdateWebhookPayload,
): BalanceWebhookPhase {
  if (payload.type === "balances:confirmed") return "confirmed";
  if (payload.type === "balances:finalized") return "finalized";
  return "unknown";
}

export interface BalanceWebhookEventEnvelope {
  id: string;
  receivedAt: string;
  payload: BalanceUpdateWebhookPayload;
}

export type BalanceWebhookSseMessage =
  | {
      type: "connected";
      connectedAt: string;
      recentEvents: BalanceWebhookEventEnvelope[];
    }
  | {
      type: "webhook";
      event: BalanceWebhookEventEnvelope;
    }
  | {
      type: "heartbeat";
      sentAt: string;
    };
