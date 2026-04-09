import {
  BalanceWebhookEventEnvelope,
  BalanceWebhookSseMessage,
} from "@/lib/types";
import { getBalanceWebhookEventStore } from "@/lib/webhook-events";

export const runtime = "nodejs";

function toSseChunk(payload: BalanceWebhookSseMessage) {
  const data = JSON.stringify(payload);
  return new TextEncoder().encode(`data: ${data}\n\n`);
}

export function GET(request: Request) {
  const store = getBalanceWebhookEventStore();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const send = (payload: BalanceWebhookSseMessage) => {
        if (isClosed) {
          return;
        }
        controller.enqueue(toSseChunk(payload));
      };

      const handleWebhookEvent = (event: BalanceWebhookEventEnvelope) => {
        send({
          type: "webhook",
          event,
        });
      };

      send({
        type: "connected",
        connectedAt: new Date().toISOString(),
        recentEvents: store.getRecentEvents(),
      });

      const unsubscribe = store.onEvent(handleWebhookEvent);
      const heartbeat = setInterval(() => {
        send({ type: "heartbeat", sentAt: new Date().toISOString() });
      }, 15_000);

      const cleanup = () => {
        if (isClosed) {
          return;
        }

        isClosed = true;
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // no-op: stream may already be closed
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
