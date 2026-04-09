import { EventEmitter } from "events";
import {
  BalanceConfirmedWebhookPayload,
  BalanceWebhookEventEnvelope,
} from "@/lib/types";

const WEBHOOK_EVENT = "balance-confirmed-webhook-event";
const MAX_RECENT_EVENTS = 30;

class BalanceWebhookEventStore {
  private readonly emitter = new EventEmitter();
  private readonly recentEvents: BalanceWebhookEventEnvelope[] = [];

  addEvent(
    payload: BalanceConfirmedWebhookPayload,
  ): BalanceWebhookEventEnvelope {
    const event: BalanceWebhookEventEnvelope = {
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      payload,
    };

    this.recentEvents.unshift(event);
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.length = MAX_RECENT_EVENTS;
    }

    this.emitter.emit(WEBHOOK_EVENT, event);
    return event;
  }

  getRecentEvents(): BalanceWebhookEventEnvelope[] {
    return [...this.recentEvents];
  }

  onEvent(listener: (event: BalanceWebhookEventEnvelope) => void): () => void {
    this.emitter.on(WEBHOOK_EVENT, listener);
    return () => this.emitter.off(WEBHOOK_EVENT, listener);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __turnkeyBalanceWebhookEventStore: BalanceWebhookEventStore | undefined;
}

export function getBalanceWebhookEventStore() {
  if (!globalThis.__turnkeyBalanceWebhookEventStore) {
    globalThis.__turnkeyBalanceWebhookEventStore =
      new BalanceWebhookEventStore();
  }

  return globalThis.__turnkeyBalanceWebhookEventStore;
}
