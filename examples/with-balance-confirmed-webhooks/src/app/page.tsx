"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  BalanceWebhookEventEnvelope,
  BalanceWebhookSseMessage,
} from "@/lib/types";

type BalanceRow = {
  symbol?: string;
  name?: string;
  caip19?: string;
  balance?: string;
  display?: {
    crypto?: string;
    usd?: string;
  };
};

type BalancesApiResponse = {
  error?: string;
  address?: string;
  caip2?: string;
  balances?: BalanceRow[];
};

const DEFAULT_ADDRESS = process.env.NEXT_PUBLIC_DEFAULT_ADDRESS ?? "";
const DEFAULT_CAIP2 = process.env.NEXT_PUBLIC_DEFAULT_CAIP2 ?? "eip155:8453";

function parseSseMessage(raw: string): BalanceWebhookSseMessage | null {
  try {
    return JSON.parse(raw) as BalanceWebhookSseMessage;
  } catch {
    return null;
  }
}

function formatUnits(value: string | undefined, decimals: number | undefined) {
  if (!value) {
    return "-";
  }

  if (typeof decimals !== "number" || decimals < 0) {
    return value;
  }

  const isNegative = value.startsWith("-");
  const numeric = isNegative ? value.slice(1) : value;

  if (!/^\d+$/.test(numeric)) {
    return value;
  }

  const padded = numeric.padStart(decimals + 1, "0");
  const wholeRaw =
    decimals === 0 ? padded : padded.slice(0, padded.length - decimals);
  const whole = wholeRaw.replace(/^0+(?=\d)/, "");
  const fraction =
    decimals === 0
      ? ""
      : padded.slice(padded.length - decimals).replace(/0+$/, "");

  const sign = isNegative ? "-" : "";
  if (!fraction) {
    return `${sign}${whole}`;
  }

  return `${sign}${whole}.${fraction}`;
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

export default function Page() {
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [caip2, setCaip2] = useState(DEFAULT_CAIP2);
  const [queriedAddress, setQueriedAddress] = useState(DEFAULT_ADDRESS);
  const [queriedCaip2, setQueriedCaip2] = useState(DEFAULT_CAIP2);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isWebhookConnected, setIsWebhookConnected] = useState(false);
  const [recentEvents, setRecentEvents] = useState<
    BalanceWebhookEventEnvelope[]
  >([]);
  const [activeNotification, setActiveNotification] =
    useState<BalanceWebhookEventEnvelope | null>(null);
  const [isFetchingBalances, startBalanceTransition] = useTransition();
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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
    const source = new EventSource("/api/events");

    source.onopen = () => {
      setIsWebhookConnected(true);
    };

    source.onmessage = (event) => {
      const message = parseSseMessage(event.data);
      if (!message) {
        return;
      }

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

    source.onerror = () => {
      setIsWebhookConnected(false);
    };

    return () => {
      source.close();
      setIsWebhookConnected(false);

      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  async function handleFetchBalances(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const params = new URLSearchParams({
      address: address.trim(),
      caip2: caip2.trim(),
    });

    try {
      const response = await fetch(`/api/balances?${params.toString()}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as BalancesApiResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to fetch balances");
      }

      setQueriedAddress(address.trim());
      setQueriedCaip2(caip2.trim());

      startBalanceTransition(() => {
        setBalances(body.balances ?? []);
      });
    } catch (fetchError) {
      setBalances([]);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unexpected error while loading balances",
      );
    }
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>Balance Confirmed Webhooks</h1>
        <p className="subtitle">
          Fetches balances with Turnkey{" "}
          <code>getWalletAddressBalances (getBalances)</code> and listens for{" "}
          <code>BALANCE_CONFIRMED_UPDATES</code> via webhook.
        </p>
        <div
          className={`status-pill ${isWebhookConnected ? "connected" : "disconnected"}`}
        >
          Webhook stream: {isWebhookConnected ? "connected" : "disconnected"}
        </div>
      </section>

      <section className="panel">
        <h2>Lookup Balances</h2>
        <form className="form-grid" onSubmit={handleFetchBalances}>
          <div className="input-group">
            <label htmlFor="address">Wallet address</label>
            <input
              id="address"
              value={address}
              onChange={(inputEvent) => setAddress(inputEvent.target.value)}
              placeholder="0x..."
            />
          </div>
          <div className="input-group">
            <label htmlFor="caip2">Network (CAIP-2)</label>
            <input
              id="caip2"
              value={caip2}
              onChange={(inputEvent) => setCaip2(inputEvent.target.value)}
              placeholder="eip155:8453"
            />
          </div>
          <button className="button-primary" disabled={isFetchingBalances}>
            {isFetchingBalances ? "Loading..." : "Get Balances"}
          </button>
        </form>
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="panel">
        <h2>
          Balances for <code>{queriedAddress || "address"}</code> on{" "}
          <code>{queriedCaip2}</code>
        </h2>
        {balances.length === 0 ? (
          <p className="balances-empty">
            No balances loaded yet. Run a query or check your address/network.
          </p>
        ) : (
          <table className="balances-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Balance</th>
                <th>USD</th>
                <th>CAIP-19</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((balance, index) => {
                const symbol = balance.symbol || balance.name || "Unknown";
                const displayBalance =
                  balance.display?.crypto || balance.balance || "-";
                const displayUsd = balance.display?.usd
                  ? `$${balance.display.usd}`
                  : "-";

                return (
                  <tr key={`${balance.caip19 ?? symbol}-${index}`}>
                    <td>{symbol}</td>
                    <td>{displayBalance}</td>
                    <td>{displayUsd}</td>
                    <td>{balance.caip19 || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>Recent Webhook Events</h2>
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
          <h3>Balance Confirmed Update Received</h3>
          <p>{getEventSummary(activeNotification)}</p>
          <p>
            {new Date(activeNotification.receivedAt).toLocaleTimeString()} •{" "}
            {typeof activeNotification.payload.msg.address === "string"
              ? activeNotification.payload.msg.address
              : "address unavailable"}
          </p>
        </aside>
      ) : null}
    </main>
  );
}
