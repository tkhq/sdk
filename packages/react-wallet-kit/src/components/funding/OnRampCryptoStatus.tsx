import { faWallet } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import { useEffect, useState } from "react";
import {
  TurnkeyError,
  TurnkeyErrorCodes,
  type WalletRpcProvider,
} from "@turnkey/core";
import { useModal } from "../../providers/modal/Hook";
import { ActionPage } from "../auth/Action";
import { ActionButton } from "../design/Buttons";
import { SuccessPage } from "../design/Success";
import { getExplorerUrl } from "../send-transaction/helpers";

const POLL_INTERVAL_MS = 1000;

export type OnRampCryptoStatusProps = {
  chain: "ethereum" | "solana";
  caip2: string;
  transactionId: string;
  provider: WalletRpcProvider;
  rpcUrl?: string | undefined;
  successPageDuration?: number | undefined;
  iconUrl?: string | undefined;
  onSuccess: () => void;
  onError: (error: unknown) => void;
};

export function OnRampCryptoStatus(props: OnRampCryptoStatusProps) {
  const {
    chain,
    caip2,
    transactionId,
    provider,
    rpcUrl,
    successPageDuration = 2000,
    iconUrl,
    onSuccess,
    onError,
  } = props;
  const { closeModal, isMobile } = useModal();
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (completed) return;

    let active = true;
    let polling = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const finish = (callback: () => void) => {
      if (!active) return;
      active = false;
      clearInterval(interval);
      callback();
    };

    const poll = async () => {
      if (!active || polling) return;
      polling = true;
      try {
        const status =
          chain === "solana"
            ? await pollSolana(transactionId, rpcUrl)
            : await pollEthereum(transactionId, provider);
        if (!active || status === "pending") return;
        if (status === "success") {
          finish(() => setCompleted(true));
          return;
        }
        finish(() => {
          onError(
            new TurnkeyError(
              "On-chain transaction failed.",
              TurnkeyErrorCodes.POLL_TRANSACTION_STATUS_ERROR,
            ),
          );
          closeModal();
        });
      } catch {
        // Keep polling. A single failed receipt request is not a failed transfer.
      } finally {
        polling = false;
      }
    };

    void poll();
    interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [
    chain,
    closeModal,
    completed,
    onError,
    onSuccess,
    provider,
    rpcUrl,
    transactionId,
  ]);

  if (completed) {
    return (
      <div
        className={clsx(
          "flex flex-col items-center py-4",
          isMobile ? "w-full" : "w-96",
        )}
      >
        <SuccessPage
          text="Transfer complete"
          duration={successPageDuration}
          onComplete={() => {
            onSuccess();
            closeModal();
          }}
        />
        <ActionButton
          name="onramp-view-explorer"
          onClick={() => {
            window.open(
              getExplorerUrl(transactionId, caip2),
              "_blank",
              "noopener,noreferrer",
            );
          }}
          className="bg-primary-light text-primary-text-light dark:bg-primary-dark dark:text-primary-text-dark"
        >
          View on block explorer
        </ActionButton>
      </div>
    );
  }

  return (
    <ActionPage
      title="Sending"
      subtitle="Waiting for the transaction to confirm."
      icon={
        iconUrl ? (
          <img src={iconUrl} alt="" className="size-10 rounded-full" />
        ) : (
          <FontAwesomeIcon icon={faWallet} className="size-10" />
        )
      }
    />
  );
}

async function pollEthereum(
  transactionId: string,
  provider: WalletRpcProvider,
): Promise<"pending" | "success" | "failed"> {
  const request = (provider as { request?: unknown }).request;
  if (typeof request !== "function") {
    throw new Error("This wallet cannot read Ethereum receipts.");
  }
  const receipt = await (
    request as (args: {
      method: string;
      params?: unknown[];
    }) => Promise<unknown>
  ).call(provider, {
    method: "eth_getTransactionReceipt",
    params: [transactionId],
  });
  if (!receipt || typeof receipt !== "object" || !("status" in receipt)) {
    return "pending";
  }
  const status = BigInt(String(receipt.status));
  if (status === 1n) return "success";
  if (status === 0n) return "failed";
  return "pending";
}

async function pollSolana(
  transactionId: string,
  rpcUrl?: string,
): Promise<"pending" | "success" | "failed"> {
  if (!rpcUrl) {
    throw new TurnkeyError(
      "Missing rpcUrl: connected Solana wallets require an RPC URL to broadcast transactions.",
      TurnkeyErrorCodes.POLL_TRANSACTION_STATUS_ERROR,
    );
  }
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getSignatureStatuses",
      params: [[transactionId], { searchTransactionHistory: true }],
    }),
  });
  const body = (await response.json()) as {
    error?: { message?: string };
    result?: {
      value?: Array<{
        err?: unknown;
        confirmationStatus?: string | null;
      } | null> | null;
    };
  };
  if (body.error) {
    throw new Error(body.error.message ?? "Solana status request failed.");
  }
  const status = body.result?.value?.[0];
  if (!status) return "pending";
  if (status.err) return "failed";
  if (
    status.confirmationStatus === "confirmed" ||
    status.confirmationStatus === "finalized"
  ) {
    return "success";
  }
  return "pending";
}
