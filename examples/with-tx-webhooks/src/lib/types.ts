// Balance-confirmed webhook types (BALANCE_CONFIRMED_UPDATES)
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
  idempotencyKey?: string;
  asset?: BalanceWebhookAsset;
  block?: BalanceWebhookBlock;
}

export interface BalanceConfirmedWebhookPayload {
  type: string;
  organizationId?: string;
  parentOrganizationId?: string;
  msg: BalanceWebhookMessage;
}

export interface BalanceWebhookEventEnvelope {
  id: string;
  receivedAt: string;
  payload: BalanceConfirmedWebhookPayload;
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

// Tx-status webhook types (SEND_TRANSACTION_STATUS_UPDATES)

export interface TxStatusWebhookMessage extends Record<string, unknown> {
  sendTransactionStatusId?: string;
  activityId?: string;
  status?: string;
  caip2?: string;
  idempotencyKey?: string;
  timestamp?: number;
  txHash?: string | null;
  txError?: string | null;
  error?: unknown;
}

export interface TxStatusWebhookPayload {
  type: string;
  organizationId?: string;
  parentOrganizationId?: string;
  msg: TxStatusWebhookMessage;
}

export interface TxStatusWebhookEventEnvelope {
  id: string;
  receivedAt: string;
  payload: TxStatusWebhookPayload;
}

export type TxStatusWebhookSseMessage =
  | {
      type: "connected";
      connectedAt: string;
      recentEvents: TxStatusWebhookEventEnvelope[];
    }
  | {
      type: "webhook";
      event: TxStatusWebhookEventEnvelope;
    }
  | {
      type: "heartbeat";
      sentAt: string;
    };
