import { EventEmitter } from "events";
import {
  BalanceWebhookPayload,
  BalanceWebhookEventEnvelope,
  TxStatusWebhookPayload,
  TxStatusWebhookEventEnvelope,
} from "@/lib/types";

const BALANCE_WEBHOOK_EVENT = "balance-confirmed-webhook-event";
const TX_STATUS_WEBHOOK_EVENT = "tx-status-webhook-event";
const MAX_RECENT_EVENTS = 30;

class BalanceWebhookEventStore {
  private readonly emitter = new EventEmitter();
  private readonly recentEvents: BalanceWebhookEventEnvelope[] = [];

  addEvent(payload: BalanceWebhookPayload): BalanceWebhookEventEnvelope {
    const event: BalanceWebhookEventEnvelope = {
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      payload,
    };

    this.recentEvents.unshift(event);
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.length = MAX_RECENT_EVENTS;
    }

    this.emitter.emit(BALANCE_WEBHOOK_EVENT, event);
    return event;
  }

  getRecentEvents(): BalanceWebhookEventEnvelope[] {
    return [...this.recentEvents];
  }

  onEvent(listener: (event: BalanceWebhookEventEnvelope) => void): () => void {
    this.emitter.on(BALANCE_WEBHOOK_EVENT, listener);
    return () => this.emitter.off(BALANCE_WEBHOOK_EVENT, listener);
  }
}

class TxStatusWebhookEventStore {
  private readonly emitter = new EventEmitter();
  private readonly recentEvents: TxStatusWebhookEventEnvelope[] = [];

  addEvent(payload: TxStatusWebhookPayload): TxStatusWebhookEventEnvelope {
    const event: TxStatusWebhookEventEnvelope = {
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      payload,
    };

    this.recentEvents.unshift(event);
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.length = MAX_RECENT_EVENTS;
    }

    this.emitter.emit(TX_STATUS_WEBHOOK_EVENT, event);
    return event;
  }

  getRecentEvents(): TxStatusWebhookEventEnvelope[] {
    return [...this.recentEvents];
  }

  onEvent(listener: (event: TxStatusWebhookEventEnvelope) => void): () => void {
    this.emitter.on(TX_STATUS_WEBHOOK_EVENT, listener);
    return () => this.emitter.off(TX_STATUS_WEBHOOK_EVENT, listener);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __turnkeyBalanceWebhookEventStore: BalanceWebhookEventStore | undefined;
  // eslint-disable-next-line no-var
  var __turnkeyTxStatusWebhookEventStore: TxStatusWebhookEventStore | undefined;
}

export function getBalanceWebhookEventStore() {
  if (!globalThis.__turnkeyBalanceWebhookEventStore) {
    globalThis.__turnkeyBalanceWebhookEventStore =
      new BalanceWebhookEventStore();
  }

  return globalThis.__turnkeyBalanceWebhookEventStore;
}

export function getTxStatusWebhookEventStore() {
  if (!globalThis.__turnkeyTxStatusWebhookEventStore) {
    globalThis.__turnkeyTxStatusWebhookEventStore =
      new TxStatusWebhookEventStore();
  }

  return globalThis.__turnkeyTxStatusWebhookEventStore;
}
