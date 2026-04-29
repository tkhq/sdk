import { EventEmitter } from "events";
import type { ActivityEventEnvelope, ActivityWebhookPayload } from "./types";

const ACTIVITY_EVENT = "activity";
const MAX_RECENT_EVENTS = 50;

class ActivityEventStore {
  private readonly emitter = new EventEmitter();
  private readonly recentEvents: ActivityEventEnvelope[] = [];

  addEvent(
    payload: ActivityWebhookPayload,
    approved: boolean,
  ): ActivityEventEnvelope {
    const event: ActivityEventEnvelope = {
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      payload,
      approved,
    };
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.length = MAX_RECENT_EVENTS;
    }
    this.emitter.emit(ACTIVITY_EVENT, event);
    return event;
  }

  getRecentEvents(): ActivityEventEnvelope[] {
    return [...this.recentEvents];
  }

  onEvent(listener: (event: ActivityEventEnvelope) => void): () => void {
    this.emitter.on(ACTIVITY_EVENT, listener);
    return () => this.emitter.off(ACTIVITY_EVENT, listener);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __turnkeyActivityEventStore: ActivityEventStore | undefined;
}

export function getActivityEventStore(): ActivityEventStore {
  if (!globalThis.__turnkeyActivityEventStore) {
    globalThis.__turnkeyActivityEventStore = new ActivityEventStore();
  }
  return globalThis.__turnkeyActivityEventStore;
}
