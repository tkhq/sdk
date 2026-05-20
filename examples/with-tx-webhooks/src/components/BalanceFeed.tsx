"use client";

import { useEffect, useRef, useState } from "react";
import {
  BalanceWebhookEventEnvelope,
  BalanceWebhookSseMessage,
} from "@/lib/types";

function parseMessage(raw: string): BalanceWebhookSseMessage | null {
  try {
    return JSON.parse(raw) as BalanceWebhookSseMessage;
  } catch {
    return null;
  }
}

function formatUnits(value: string | undefined, decimals: number | undefined) {
  if (!value) return "-";
  if (typeof decimals !== "number" || decimals < 0) return value;

  const isNegative = value.startsWith("-");
  const numeric = isNegative ? value.slice(1) : value;
  if (!/^\d+$/.test(numeric)) return value;

  const padded = numeric.padStart(decimals + 1, "0");
  const wholeRaw =
    decimals === 0 ? padded : padded.slice(0, padded.length - decimals);
  const whole = wholeRaw.replace(/^0+(?=\d)/, "");
  const fraction =
    decimals === 0
      ? ""
      : padded.slice(padded.length - decimals).replace(/0+$/, "");

  const sign = isNegative ? "-" : "";
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

function getEventSummary(event: BalanceWebhookEventEnvelope) {
  const { msg, type } = event.payload;
  const operation =
    typeof msg.operation === "string" ? msg.operation.toUpperCase() : "UPDATE";
  const symbol =
    typeof msg.asset?.symbol === "string" ? msg.asset.symbol : "asset";
  const amount = formatUnits(msg.asset?.amount, msg.asset?.decimals);
  const caip2 = typeof msg.caip2 === "string" ? msg.caip2 : "unknown network";
  return `${type} • ${operation} ${amount} ${symbol} on ${caip2}`;
}

interface Props {
  onWebhookEvent?: (event: BalanceWebhookEventEnvelope) => void;
}

export function BalanceFeed({ onWebhookEvent }: Props) {
  const [isConnected, setIsConnected] = useState(false);
  const [recentEvents, setRecentEvents] = useState<
    BalanceWebhookEventEnvelope[]
  >([]);
  const [activeNotification, setActiveNotification] =
    useState<BalanceWebhookEventEnvelope | null>(null);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const onWebhookEventRef = useRef(onWebhookEvent);

  useEffect(() => {
    onWebhookEventRef.current = onWebhookEvent;
  }, [onWebhookEvent]);

  const showNotification = (event: BalanceWebhookEventEnvelope) => {
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
    const source = new EventSource("/api/balance-events");

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
        onWebhookEventRef.current?.(message.event);
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
            Balance Confirmed Events{" "}
            <small>
              (<code>BALANCE_CONFIRMED_UPDATES</code>)
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
            Waiting for webhook events on <code>/webhook/balance-updates</code>.
          </p>
        ) : (
          <ul className="event-list">
            {recentEvents.map((event) => {
              const summary = getEventSummary(event);
              const txHash =
                typeof event.payload.msg.txHash === "string"
                  ? event.payload.msg.txHash
                  : "n/a";
              return (
                <li className="event-item" key={event.id}>
                  <p className="event-title">{summary}</p>
                  <p className="event-meta">
                    {new Date(event.receivedAt).toLocaleString()} • txHash:{" "}
                    {txHash}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {activeNotification ? (
        <aside className="notification">
          <h3>Balance Confirmed Update</h3>
          <p>{getEventSummary(activeNotification)}</p>
          <p>
            {new Date(activeNotification.receivedAt).toLocaleTimeString()} •{" "}
            {typeof activeNotification.payload.msg.address === "string"
              ? activeNotification.payload.msg.address
              : "address unavailable"}
          </p>
        </aside>
      ) : null}
    </>
  );
}
