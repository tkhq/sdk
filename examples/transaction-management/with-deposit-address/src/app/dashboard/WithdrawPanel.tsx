"use client";

import { useCallback, useEffect, useState } from "react";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import {
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  parseUnits,
  type Address,
} from "viem";

import {
  BASE_SEPOLIA_CAIP2,
  BASE_SEPOLIA_EXPLORER,
  USDC_ADDRESS,
  USDC_DECIMALS,
  parseAddress,
  sweepAssetOf,
  type SweepAsset,
} from "@/lib/deposit";

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
          from: address,
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
    <div className="flex flex-col gap-3 text-xs sm:text-sm">
      <div className="flex items-center gap-4">
        <span>
          ETH: <strong>{formatUnits(balances.ETH, 18)}</strong>
        </span>
        <span>
          USDC: <strong>{formatUnits(balances.USDC, USDC_DECIMALS)}</strong>
        </span>
        <button
          type="button"
          onClick={() => void loadBalances().catch(() => undefined)}
          className="text-xs text-blue-700 hover:underline"
        >
          Refresh
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Deposits are swept as they arrive, so the balance is usually zero. Run
        the server with <code>SWEEP_ENABLED=false</code> to keep a deposit here
        and try a withdrawal.
      </p>

      <div className="flex gap-2">
        <select
          value={asset}
          onChange={(e) => setAsset(e.target.value === "ETH" ? "ETH" : "USDC")}
          className="p-2 border rounded"
        >
          <option value="USDC">USDC</option>
          <option value="ETH">ETH</option>
        </select>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="w-32 p-2 border rounded font-mono text-xs"
        />
      </div>
      <input
        type="text"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="Recipient 0x…"
        spellCheck={false}
        className="w-full p-2 border rounded font-mono text-xs"
      />
      <div>
        <button
          type="button"
          onClick={handleWithdraw}
          disabled={sending}
          className="rounded bg-slate-700 px-4 py-2 text-white text-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Withdraw"}
        </button>
      </div>

      {txHash && (
        <div className="text-emerald-700">
          Sent:{" "}
          <a
            href={`${BASE_SEPOLIA_EXPLORER}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono hover:underline break-all"
          >
            {txHash}
          </a>
        </div>
      )}
      {error && (
        <div className="p-3 border border-red-300 bg-red-50 rounded text-red-700 text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
