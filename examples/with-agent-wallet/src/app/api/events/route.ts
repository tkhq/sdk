import type { ActivityEventEnvelope, ActivitySseMessage } from "@/lib/types";
import { getActivityEventStore } from "@/lib/activity-events";

export const runtime = "nodejs";

function toSseChunk(payload: ActivitySseMessage) {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export function GET(request: Request) {
  const store = getActivityEventStore();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const send = (payload: ActivitySseMessage) => {
        if (isClosed) return;
        controller.enqueue(toSseChunk(payload));
      };

      const handleEvent = (event: ActivityEventEnvelope) => {
        send({ type: "activity-update", event });
      };

      send({
        type: "connected",
        connectedAt: new Date().toISOString(),
        recentEvents: store.getRecentEvents(),
      });

      const unsubscribe = store.onEvent(handleEvent);
      const heartbeat = setInterval(() => {
        send({ type: "heartbeat", sentAt: new Date().toISOString() });
      }, 15_000);

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // stream may already be closed
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
