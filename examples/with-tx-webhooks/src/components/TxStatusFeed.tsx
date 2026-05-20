"use client";

import { useEffect, useRef, useState } from "react";
import {
  TxStatusWebhookEventEnvelope,
  TxStatusWebhookSseMessage,
} from "@/lib/types";

function parseMessage(raw: string): TxStatusWebhookSseMessage | null {
  try {
    return JSON.parse(raw) as TxStatusWebhookSseMessage;
  } catch {
    return null;
  }
}

function getEventSummary(event: TxStatusWebhookEventEnvelope) {
  const { msg } = event.payload;
  const status =
    typeof msg.status === "string" ? msg.status.toUpperCase() : "STATUS UPDATE";
  const caip2 = typeof msg.caip2 === "string" ? msg.caip2 : "unknown network";
  const txHash =
    typeof msg.txHash === "string" ? msg.txHash.slice(0, 10) + "…" : "n/a";
  return `${status} • txHash: ${txHash} on ${caip2}`;
}

export function TxStatusFeed() {
  const [isConnected, setIsConnected] = useState(false);
  const [recentEvents, setRecentEvents] = useState<
    TxStatusWebhookEventEnvelope[]
  >([]);
  const [activeNotification, setActiveNotification] =
    useState<TxStatusWebhookEventEnvelope | null>(null);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const showNotification = (event: TxStatusWebhookEventEnvelope) => {
    setActiveNotification(event);
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    notificationTimeoutRef.current = setTimeout(() => {
      setActiveNotification((current) =>
        current?.id === event.id ? null : current,
      );
    }, 6_000);
  };

  useEffect(() => {
    const source = new EventSource("/api/tx-events");

    source.onopen = () => setIsConnected(true);

    source.onmessage = (e) => {
      const message = parseMessage(e.data);
      if (!message) return;

      if (message.type === "connected") {
        setRecentEvents(message.recentEvents);
      }

      if (message.type === "webhook") {
        setRecentEvents((previous) =>
          [message.event, ...previous].slice(0, 30),
        );
        showNotification(message.event);
      }
    };

    source.onerror = () => setIsConnected(false);

    return () => {
      source.close();
      setIsConnected(false);
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <h2>
            Transaction Status Events{" "}
            <small>
              (<code>SEND_TRANSACTION_STATUS_UPDATES</code>)
            </small>
          </h2>
          <div
            className={`status-pill ${isConnected ? "connected" : "disconnected"}`}
          >
            {isConnected ? "connected" : "disconnected"}
          </div>
        </div>
        {recentEvents.length === 0 ? (
          <p className="balances-empty">
            Waiting for webhook events on <code>/webhook/tx-updates</code>.
          </p>
        ) : (
          <ul className="event-list">
            {recentEvents.map((event) => {
              const { msg } = event.payload;
              const status =
                typeof msg.status === "string" ? msg.status : "UNKNOWN";
              const caip2 =
                typeof msg.caip2 === "string" ? msg.caip2 : "unknown network";
              const txHash =
                typeof msg.txHash === "string" ? msg.txHash : "n/a";
              const txError =
                typeof msg.txError === "string" ? msg.txError : null;
              return (
                <li className="event-item" key={event.id}>
                  <p className="event-title">
                    {status} on {caip2}
                  </p>
                  <p className="event-meta">
                    {new Date(event.receivedAt).toLocaleString()} • txHash:{" "}
                    {txHash}
                  </p>
                  {txError ? (
                    <p className="error-text">Error: {txError}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {activeNotification ? (
        <aside className="notification notification-tx">
          <h3>Transaction Status Update</h3>
          <p>{getEventSummary(activeNotification)}</p>
          <p>
            {new Date(activeNotification.receivedAt).toLocaleTimeString()} •{" "}
            {typeof activeNotification.payload.msg.orgID === "string"
              ? `org: ${activeNotification.payload.msg.orgID}`
              : "org unavailable"}
          </p>
        </aside>
      ) : null}
    </>
  );
}
