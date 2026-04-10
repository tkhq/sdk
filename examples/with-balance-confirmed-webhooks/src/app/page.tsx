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
  decimals?: number;
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

type EthSendApiResponse = {
  ok?: boolean;
  error?: string;
  from?: string;
  to?: string;
  caip2?: string;
  amountBaseUnits?: string;
  assetType?: "NATIVE" | "ERC20";
  tokenContractAddress?: string;
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

function parseAmountToBaseUnits(
  amount: string,
  decimals: number,
): string | null {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }

  const [wholePart, fractionalPart = ""] = trimmed.split(".");
  if (fractionalPart.length > decimals) {
    return null;
  }

  const base = BigInt("10") ** BigInt(decimals);
  const wholeBaseUnits = BigInt(wholePart || "0") * base;
  const paddedFraction = fractionalPart.padEnd(decimals, "0");
  const fractionalBaseUnits = BigInt(paddedFraction || "0");
  const totalBaseUnits = wholeBaseUnits + fractionalBaseUnits;

  if (totalBaseUnits <= BigInt(0)) {
    return null;
  }

  return totalBaseUnits.toString();
}

function extractErc20ContractFromCaip19(caip19?: string): string | null {
  if (!caip19) {
    return null;
  }

  const match = caip19.match(/\/erc20:(0x[a-fA-F0-9]{40})/i);
  return match?.[1] ?? null;
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
  const [isSendingTx, setIsSendingTx] = useState(false);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const queriedAddressRef = useRef(queriedAddress);
  const queriedCaip2Ref = useRef(queriedCaip2);

  useEffect(() => {
    queriedAddressRef.current = queriedAddress;
    queriedCaip2Ref.current = queriedCaip2;
  }, [queriedAddress, queriedCaip2]);

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

  const fetchBalancesFromApi = async (params: {
    address: string;
    caip2: string;
    commitQuery: boolean;
    surfaceErrors: boolean;
  }) => {
    const trimmedAddress = params.address.trim();
    const trimmedCaip2 = params.caip2.trim();

    const queryParams = new URLSearchParams({
      address: trimmedAddress,
      caip2: trimmedCaip2,
    });

    try {
      const response = await fetch(`/api/balances?${queryParams.toString()}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as BalancesApiResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to fetch balances");
      }

      if (params.commitQuery) {
        setQueriedAddress(trimmedAddress);
        setQueriedCaip2(trimmedCaip2);
      }

      startBalanceTransition(() => {
        setBalances(body.balances ?? []);
      });
    } catch (fetchError) {
      if (params.surfaceErrors) {
        setBalances([]);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unexpected error while loading balances",
        );
      } else {
        console.error(
          "Failed to auto-refresh balances after webhook:",
          fetchError,
        );
      }
    }
  };

  const maybeRefreshBalancesForWebhook = (
    event: BalanceWebhookEventEnvelope,
  ) => {
    const activeAddress = queriedAddressRef.current.trim();
    const activeCaip2 = queriedCaip2Ref.current.trim();
    const eventCaip2 =
      typeof event.payload.msg.caip2 === "string"
        ? event.payload.msg.caip2
        : "";

    if (!activeAddress || !activeCaip2 || eventCaip2 !== activeCaip2) {
      return;
    }

    const eventAddress =
      typeof event.payload.msg.address === "string"
        ? event.payload.msg.address.toLowerCase()
        : "";

    if (eventAddress && eventAddress !== activeAddress.toLowerCase()) {
      return;
    }

    void fetchBalancesFromApi({
      address: activeAddress,
      caip2: activeCaip2,
      commitQuery: false,
      surfaceErrors: false,
    });
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
        maybeRefreshBalancesForWebhook(message.event);
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
    await fetchBalancesFromApi({
      address,
      caip2,
      commitQuery: true,
      surfaceErrors: true,
    });
  }

  async function handleSendAsset(balance: BalanceRow) {
    setError(null);

    const fromAddress = queriedAddress.trim();
    const network = queriedCaip2.trim();

    if (!fromAddress || !network) {
      setError("Set both sender address and CAIP-2 before sending.");
      return;
    }

    const toAddress = window.prompt(
      "Recipient address (0x...)",
      "0x0000000000000000000000000000000000000000",
    );
    if (!toAddress) {
      return;
    }

    const symbol = balance.symbol || balance.name || "asset";
    const decimals =
      typeof balance.decimals === "number" ? balance.decimals : 18;
    const erc20Contract = extractErc20ContractFromCaip19(balance.caip19);
    const assetType: "NATIVE" | "ERC20" = erc20Contract ? "ERC20" : "NATIVE";
    const amountText = window.prompt(`Amount to send (${symbol})`, "0.000001");
    if (!amountText) {
      return;
    }

    const amountBaseUnits = parseAmountToBaseUnits(amountText, decimals);
    if (!amountBaseUnits) {
      setError(
        `Invalid ${symbol} amount. Use up to ${decimals} decimals and a value > 0.`,
      );
      return;
    }

    setIsSendingTx(true);

    try {
      const response = await fetch("/api/eth-send", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: toAddress.trim(),
          amountBaseUnits,
          caip2: network,
          assetType,
          tokenContractAddress: erc20Contract ?? undefined,
        }),
      });

      const body = (await response.json()) as EthSendApiResponse;
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to send Ethereum transaction");
      }

      await fetchBalancesFromApi({
        address: fromAddress,
        caip2: network,
        commitQuery: true,
        surfaceErrors: false,
      });
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Failed to send Ethereum transaction",
      );
    } finally {
      setIsSendingTx(false);
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
                <th>Actions</th>
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
                const erc20Contract = extractErc20ContractFromCaip19(
                  balance.caip19,
                );
                const isEvmNetwork = queriedCaip2.startsWith("eip155:");
                const canSend = Boolean(queriedAddress) && isEvmNetwork;

                return (
                  <tr key={`${balance.caip19 ?? symbol}-${index}`}>
                    <td>{symbol}</td>
                    <td>{displayBalance}</td>
                    <td>{displayUsd}</td>
                    <td>{balance.caip19 || "-"}</td>
                    <td>
                      <button
                        className="table-action-button"
                        type="button"
                        disabled={!canSend || isSendingTx}
                        onClick={() => {
                          void handleSendAsset(balance);
                        }}
                      >
                        {isSendingTx
                          ? "Sending..."
                          : erc20Contract
                            ? `Send ${symbol} (ERC20)`
                            : `Send ${symbol} (Native)`}
                      </button>
                    </td>
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
