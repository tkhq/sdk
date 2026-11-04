"use client";

import { useCallback, useEffect, useState } from "react";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import {
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  parseUnits,
  type Address,
} from "viem";

import {
  BASE_SEPOLIA_CAIP2,
  USDC_ADDRESS,
  USDC_DECIMALS,
  parseAddress,
  sweepAssetOf,
  type SweepAsset,
} from "@/lib/deposit";
import {
  ErrorNotice,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
  TxLink,
} from "./ui";

const DECIMALS: Record<SweepAsset, number> = { ETH: 18, USDC: USDC_DECIMALS };

// Withdraw is signed by the user's own session, not by the delegated key. The
// user is the root of the sub-org, so no policy is needed and the platform
// cannot block it.
export function WithdrawPanel({
  subOrgId,
  address,
}: {
  subOrgId: string;
  address: Address;
}) {
  const { httpClient, ethSendTransaction, pollTransactionStatus } =
    useTurnkey();

  const [balances, setBalances] = useState<Record<SweepAsset, bigint>>({
    ETH: BigInt(0),
    USDC: BigInt(0),
  });
  const [asset, setAsset] = useState<SweepAsset>("USDC");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const loadBalances = useCallback(async () => {
    if (!httpClient) return;
    const { balances: list = [] } = await httpClient.getWalletAddressBalances({
      organizationId: subOrgId,
      address,
      caip2: BASE_SEPOLIA_CAIP2,
    });
    const next = { ETH: BigInt(0), USDC: BigInt(0) };
    for (const b of list) {
      const kind = b.caip19 ? sweepAssetOf(b.caip19) : null;
      if (kind && b.balance) next[kind] = BigInt(b.balance);
    }
    setBalances(next);
  }, [httpClient, subOrgId, address]);

  useEffect(() => {
    void loadBalances().catch(() => undefined);
  }, [loadBalances]);

  const handleWithdraw = async () => {
    setError(null);
    setTxHash(null);
    const recipient = parseAddress(to);
    if (!recipient) {
      setError("Enter a valid 0x recipient address.");
      return;
    }
    let value: bigint;
    try {
      value = parseUnits(amount.trim(), DECIMALS[asset]);
    } catch {
      setError("Enter a valid amount.");
      return;
    }
    if (value <= BigInt(0) || value > balances[asset]) {
      setError(`Amount must be more than 0 and at most your ${asset} balance.`);
      return;
    }

    const call =
      asset === "ETH"
        ? { to: recipient, value: value.toString() }
        : {
            to: USDC_ADDRESS,
            value: "0",
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "transfer",
              args: [recipient, value],
            }),
          };

    setSending(true);
    try {
      const sendTransactionStatusId = await ethSendTransaction({
        organizationId: subOrgId,
        transaction: {
          // Turnkey matches a signing address case-sensitively.
          from: getAddress(address),
          caip2: BASE_SEPOLIA_CAIP2,
          sponsor: true,
          calls: [call],
        },
      });
      const status = await pollTransactionStatus({
        organizationId: subOrgId,
        sendTransactionStatusId,
      });
      setTxHash(status.eth?.txHash ?? null);
      setAmount("");
      await loadBalances();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdrawal failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-4 text-sm">
        <span>
          <strong className="font-medium">
            {formatUnits(balances.USDC, USDC_DECIMALS)}
          </strong>{" "}
          <span className="text-slate-500">USDC</span>
        </span>
        <span>
          <strong className="font-medium">
            {formatUnits(balances.ETH, 18)}
          </strong>{" "}
          <span className="text-slate-500">ETH</span>
        </span>
        <button
          type="button"
          onClick={() => void loadBalances().catch(() => undefined)}
          className={`ml-auto ${TEXT_BUTTON_CLASS}`}
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          aria-label="Amount"
          className={INPUT_CLASS}
        />
        <select
          value={asset}
          onChange={(e) => setAsset(e.target.value === "ETH" ? "ETH" : "USDC")}
          aria-label="Asset"
          className="rounded-md border border-slate-300 bg-white px-2 py-2 text-xs"
        >
          <option value="USDC">USDC</option>
          <option value="ETH">ETH</option>
        </select>
      </div>
      <input
        type="text"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="Recipient 0x…"
        aria-label="Recipient"
        spellCheck={false}
        className={INPUT_CLASS}
      />
      <button
        type="button"
        onClick={handleWithdraw}
        disabled={sending}
        className={PRIMARY_BUTTON_CLASS}
      >
        {sending ? "Sending…" : "Withdraw"}
      </button>

      {txHash && (
        <p className="text-xs text-emerald-700">
          Sent <TxLink hash={txHash} />
        </p>
      )}
      {error && <ErrorNotice>{error}</ErrorNotice>}

      <p className="text-xs text-slate-500">
        Deposits are swept as they arrive, so this is usually zero. To try a
        withdrawal, run the server with{" "}
        <code className="font-mono">SWEEP_ENABLED=false</code>.
      </p>
    </div>
  );
}
