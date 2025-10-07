"use client";

import { useEffect, useState, useTransition } from "react";
import { useTurnkey, WalletAccount } from "@turnkey/react-wallet-kit";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { TurnkeySigner } from "@turnkey/solana";
import {
  createDepositTx,
  createWithdrawTx,
  getUserData,
} from "../actions/breeze";

const connection = new Connection(
  "https://solana-rpc.publicnode.com",
  "confirmed",
);
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function LoginButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full mt-6 bg-black hover:bg-gray-800 text-white font-semibold py-4 rounded-xl transition-all active:scale-98"
    >
      Login / Sign Up
    </button>
  );
}

function LogoutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full mt-6 bg-red-500 hover:bg-red-400 text-white font-semibold py-4 rounded-xl transition-all active:scale-98"
    >
      Log out
    </button>
  );
}

export default function BreezeStakingPage() {
  const { wallets, httpClient, handleLogin, logout, session } = useTurnkey();
  const [activeWalletAccount, setActiveWalletAccount] =
    useState<WalletAccount | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [balances, setBalances] = useState<any[]>([]);
  const [yieldInfo, setYieldInfo] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const turnkeySigner = activeWalletAccount
    ? new TurnkeySigner({
        organizationId: activeWalletAccount.organizationId,
        client: httpClient!,
      })
    : null;

  // Filter only Solana accounts
  const solAccounts =
    wallets
      ?.flatMap((w) => w.accounts)
      .filter((a) => {
        try {
          new PublicKey(a.address);
          return true;
        } catch {
          return false;
        }
      }) || [];

  useEffect(() => {
    if (!activeWalletAccount && solAccounts.length > 0) {
      setActiveWalletAccount(solAccounts[0]);
    }
  }, [wallets]);

  const fetchUserInfo = () => {
    if (!activeWalletAccount) return;
    startTransition(async () => {
      const { balances, yieldInfo } = await getUserData(
        activeWalletAccount.address,
      );
      setBalances(balances);
      setYieldInfo(yieldInfo);
    });
  };

  useEffect(() => {
    if (activeWalletAccount) fetchUserInfo();
  }, [activeWalletAccount]);

  const handleTransaction = async (type: "deposit" | "withdraw") => {
    try {
      if (!activeWalletAccount || !turnkeySigner) {
        setStatusMessage("❌ Please login and select an account");
        return;
      }

      setProcessing(true);
      setModalOpen(true);
      setTxid(null);
      setStatusMessage(
        `${type === "deposit" ? "Depositing" : "Withdrawing"} 1 USDC...`,
      );

      const txBase64 =
        type === "deposit"
          ? await createDepositTx({
              payerKey: activeWalletAccount.address,
              userKey: activeWalletAccount.address,
              fundId: process.env.NEXT_PUBLIC_FUND_ID!,
              amount: 1_000_000,
              mint: USDC_MINT,
            })
          : await createWithdrawTx({
              payerKey: activeWalletAccount.address,
              userKey: activeWalletAccount.address,
              fundId: process.env.NEXT_PUBLIC_FUND_ID!,
              amount: 1_000_000,
            });

      const rawBytes = Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0));
      const transaction = VersionedTransaction.deserialize(rawBytes);
      await turnkeySigner.addSignature(
        transaction,
        activeWalletAccount.address,
      );

      const txidLocal = await connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          maxRetries: 3,
        },
      );
      await connection.confirmTransaction(txidLocal, "confirmed");

      setTxid(txidLocal);
      setStatusMessage(
        `✅ ${type === "deposit" ? "Deposit" : "Withdrawal"} successful`,
      );
      fetchUserInfo();
    } catch (err: any) {
      setStatusMessage(`❌ Error: ${err.message}`);
    } finally {
      setProcessing(false);
      setTimeout(() => setModalOpen(false), 5000);
    }
  };

  const handleLogout = () => {
    setActiveWalletAccount(null);
    logout();
  };

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-4">
        {!session ? (
          <LoginButton onClick={handleLogin} />
        ) : (
          <LogoutButton onClick={handleLogout} />
        )}

        {session && solAccounts.length > 0 && (
          <>
            {/* Wallet selector */}
            <div className="flex flex-col gap-2 mb-4">
              <label className="text-sm text-gray-600 font-medium">
                Select Wallet Account
              </label>
              <select
                value={activeWalletAccount?.address || ""}
                onChange={(e) => {
                  const selected = solAccounts.find(
                    (a) => a.address === e.target.value,
                  );
                  setActiveWalletAccount(selected || null);
                }}
                className="border border-gray-300 rounded-xl px-3 py-2 text-black outline-none"
              >
                <option value="" disabled>
                  -- Select a SOL account --
                </option>
                {solAccounts.map((account) => (
                  <option key={account.address} value={account.address}>
                    {account.address.slice(0, 6)}…{account.address.slice(-4)}
                  </option>
                ))}
              </select>
            </div>

            {/* Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h1 className="text-2xl font-bold text-black mb-6">Staking</h1>

              {/* Balances */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-3">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">
                  Staked USDC Balance
                </h2>
                {balances.length > 0 ? (
                  (() => {
                    const usdc = balances.find(
                      (b) => b.token_address === USDC_MINT,
                    );
                    if (!usdc)
                      return (
                        <p className="text-gray-500 text-sm">No USDC found.</p>
                      );
                    const usdcBalance =
                      usdc.total_balance / 10 ** usdc.decimals;
                    return (
                      <p className="text-black font-semibold">
                        {usdcBalance.toFixed(2)} USDC
                      </p>
                    );
                  })()
                ) : (
                  <p className="text-gray-500 text-sm">
                    No balances available.
                  </p>
                )}
              </div>

              {/* Yield */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">
                  USDC Yield
                </h2>
                {yieldInfo.length > 0 ? (
                  (() => {
                    const usdcYield = yieldInfo.find(
                      (y) => y.base_asset === "USDC",
                    );
                    if (!usdcYield)
                      return (
                        <p className="text-gray-500 text-sm">
                          No USDC yield found.
                        </p>
                      );
                    const earned = usdcYield.yield_earned / 1_000_000;
                    const apy = usdcYield.apy?.toFixed(2);
                    return (
                      <div className="text-black space-y-1">
                        <p>
                          <span className="font-semibold">
                            {earned.toFixed(4)} USDC
                          </span>{" "}
                          earned
                        </p>
                        <p className="text-gray-600">APY: {apy}%</p>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-gray-500 text-sm">
                    No yield info available.
                  </p>
                )}
              </div>

              {/* Actions */}
              <button
                onClick={() => handleTransaction("deposit")}
                disabled={processing}
                className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-xl transition-all active:scale-98"
              >
                {processing ? "Processing..." : "Deposit 1 USDC"}
              </button>

              <button
                onClick={() => handleTransaction("withdraw")}
                disabled={processing}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-all active:scale-98"
              >
                {processing ? "Processing..." : "Withdraw 1 USDC"}
              </button>

              {statusMessage && (
                <p className="text-center text-sm mt-4 text-gray-700">
                  {statusMessage}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="absolute inset-0 bg-white bg-opacity-95 backdrop-blur-sm rounded-2xl flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-6 p-8">
            {processing ? (
              <>
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-black mb-1">
                    Processing transaction...
                  </h2>
                  <p className="text-sm text-gray-600">
                    Please wait while your staking transaction is confirmed
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="relative w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-black mb-1">
                    Transaction complete
                  </h2>
                  <p className="text-sm text-gray-600 mb-2">
                    Your staking action has been completed successfully.
                  </p>
                  {txid && (
                    <a
                      href={`https://solscan.io/tx/${txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View on Solscan
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
