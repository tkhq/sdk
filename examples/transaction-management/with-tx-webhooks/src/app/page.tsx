"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { BalanceWebhookEventEnvelope } from "@/lib/types";
import { BalanceFeed } from "@/components/BalanceFeed";
import { TxStatusFeed } from "@/components/TxStatusFeed";

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

type SendAssetApiResponse = {
  ok?: boolean;
  error?: string;
  from?: string;
  to?: string;
  caip2?: string;
  amountBaseUnits?: string;
  assetType?: "NATIVE" | "ERC20" | "SPL";
  tokenContractAddress?: string;
  tokenMintAddress?: string;
};

const DEFAULT_ADDRESS = process.env.NEXT_PUBLIC_DEFAULT_ADDRESS ?? "";
const DEFAULT_CAIP2 = process.env.NEXT_PUBLIC_DEFAULT_CAIP2 ?? "eip155:8453";

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

function extractSplMintFromCaip19(caip19?: string): string | null {
  if (!caip19) {
    return null;
  }

  const match = caip19.match(/\/token:([1-9A-HJ-NP-Za-km-z]+)$/);
  return match?.[1] ?? null;
}

function getNetworkKind(caip2: string): "EVM" | "SVM" | "UNKNOWN" {
  if (caip2.startsWith("eip155:")) {
    return "EVM";
  }

  if (caip2.startsWith("solana:")) {
    return "SVM";
  }

  return "UNKNOWN";
}

function normalizeCaip2ForComparison(caip2: string): string {
  switch (caip2) {
    case "solana:mainnet":
    case "solana:mainnet-beta":
      return "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
    case "solana:devnet":
      return "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
    default:
      return caip2;
  }
}

function normalizeAddressForComparison(address: string, caip2: string): string {
  return getNetworkKind(caip2) === "EVM" ? address.toLowerCase() : address;
}

export default function Page() {
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [caip2, setCaip2] = useState(DEFAULT_CAIP2);
  const [queriedAddress, setQueriedAddress] = useState(DEFAULT_ADDRESS);
  const [queriedCaip2, setQueriedCaip2] = useState(DEFAULT_CAIP2);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingBalances, startBalanceTransition] = useTransition();
  const [isSendingTx, setIsSendingTx] = useState(false);
  const queriedAddressRef = useRef(queriedAddress);
  const queriedCaip2Ref = useRef(queriedCaip2);

  useEffect(() => {
    queriedAddressRef.current = queriedAddress;
    queriedCaip2Ref.current = queriedCaip2;
  }, [queriedAddress, queriedCaip2]);

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

    const normalizedActiveCaip2 = normalizeCaip2ForComparison(activeCaip2);
    const normalizedEventCaip2 = normalizeCaip2ForComparison(eventCaip2);

    if (
      !activeAddress ||
      !activeCaip2 ||
      normalizedEventCaip2 !== normalizedActiveCaip2
    ) {
      return;
    }

    const eventAddress =
      typeof event.payload.msg.address === "string"
        ? normalizeAddressForComparison(event.payload.msg.address, eventCaip2)
        : "";

    const normalizedActiveAddress = normalizeAddressForComparison(
      activeAddress,
      activeCaip2,
    );

    if (eventAddress && eventAddress !== normalizedActiveAddress) {
      return;
    }

    void fetchBalancesFromApi({
      address: activeAddress,
      caip2: activeCaip2,
      commitQuery: false,
      surfaceErrors: false,
    });
  };

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

    const networkKind = getNetworkKind(network);
    if (networkKind === "UNKNOWN") {
      setError("Unsupported network. Use an EVM or Solana CAIP-2 value.");
      return;
    }

    const toAddress = window.prompt(
      `Recipient address (${networkKind === "SVM" ? "base58" : "0x..."})`,
      fromAddress,
    );
    if (!toAddress) {
      return;
    }

    const symbol = balance.symbol || balance.name || "asset";
    const decimals =
      typeof balance.decimals === "number" ? balance.decimals : 18;
    const erc20Contract = extractErc20ContractFromCaip19(balance.caip19);
    const splMint = extractSplMintFromCaip19(balance.caip19);
    const assetType: "NATIVE" | "ERC20" | "SPL" =
      networkKind === "EVM"
        ? erc20Contract
          ? "ERC20"
          : "NATIVE"
        : splMint
          ? "SPL"
          : "NATIVE";
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
      const response = await fetch("/api/tx-send", {
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
          tokenMintAddress: splMint ?? undefined,
        }),
      });

      const body = (await response.json()) as SendAssetApiResponse;
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to send transaction");
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
          : "Failed to send transaction",
      );
    } finally {
      setIsSendingTx(false);
    }
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>Turnkey Webhook Feeds</h1>
        <p className="subtitle">
          Fetches balances with Turnkey{" "}
          <code>getWalletAddressBalances (getBalances)</code> and listens for
          live <code>BALANCE_CONFIRMED_UPDATES</code>,{" "}
          <code>BALANCE_FINALIZED_UPDATES</code>, and{" "}
          <code>SEND_TRANSACTION_STATUS_UPDATES</code> webhook events across EVM
          and SVM networks.
        </p>
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
                const splMint = extractSplMintFromCaip19(balance.caip19);
                const networkKind = getNetworkKind(queriedCaip2);
                const canSend =
                  Boolean(queriedAddress) && networkKind !== "UNKNOWN";
                const sendLabel =
                  networkKind === "EVM"
                    ? erc20Contract
                      ? `Send ${symbol} (ERC20)`
                      : `Send ${symbol} (Native)`
                    : splMint
                      ? `Send ${symbol} (SPL)`
                      : `Send ${symbol} (Native)`;

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
                        {isSendingTx ? "Sending..." : sendLabel}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <BalanceFeed onWebhookEvent={maybeRefreshBalancesForWebhook} />

      <TxStatusFeed />
    </main>
  );
}
