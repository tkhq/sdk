"use client";

import { useEffect, useState } from "react";
import { useTurnkey, WalletAccount } from "@turnkey/react-wallet-kit";
import { VersionedTransaction, PublicKey } from "@solana/web3.js";
import { TurnkeySigner } from "@turnkey/solana";
import {
  createUltraOrder,
  executeUltraOrder,
  getUltraBalances,
  getUltraQuote,
} from "../actions/jupiter";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL_MINT = "So11111111111111111111111111111111111111112";

function SolIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 256 256"
    >
      <linearGradient
        id="a"
        x1="44.9"
        x2="211.4"
        y1="43.8"
        y2="214.8"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#00FFA3" />
        <stop offset="1" stopColor="#DC1FFF" />
      </linearGradient>
      <path
        fill="url(#a)"
        d="M64.2 163.6a4.5 4.5 0 0 1 3.2-1.3h159.4a2.5 2.5 0 0 1 1.8 4.2l-36.5 38.3a4.5 4.5 0 0 1-3.2 1.3H29.5a2.5 2.5 0 0 1-1.8-4.2zm0-109.2A4.5 4.5 0 0 1 67.4 53h159.4a2.5 2.5 0 0 1 1.8 4.2l-36.5 38.3a4.5 4.5 0 0 1-3.2 1.3H29.5a2.5 2.5 0 0 1-1.8-4.2zm0 54.6a4.5 4.5 0 0 1 3.2-1.3h159.4a2.5 2.5 0 0 1 1.8 4.2l-36.5 38.3a4.5 4.5 0 0 1-3.2 1.3H29.5a2.5 2.5 0 0 1-1.8-4.2z"
      />
    </svg>
  );
}

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

export default function JupiterSwapPage() {
  const { wallets, httpClient, handleLogin, logout, session } = useTurnkey();
  const [activeWalletAccount, setActiveWalletAccount] =
    useState<WalletAccount | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromToken, setFromToken] = useState<"USDC" | "SOL">("USDC");
  const [toToken, setToToken] = useState<"USDC" | "SOL">("SOL");
  const [swapping, setSwapping] = useState(false);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [swapHash, setSwapHash] = useState("");
  const [balances, setBalances] = useState<{ SOL: number; USDC: number }>({
    SOL: 0,
    USDC: 0,
  });

  const turnkeySigner = activeWalletAccount
    ? new TurnkeySigner({
        organizationId: activeWalletAccount.organizationId,
        client: httpClient!,
      })
    : null;

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

  const fetchBalances = async () => {
    const taker = new PublicKey(activeWalletAccount!.address).toBase58();
    const data = await getUltraBalances(taker);
    setBalances({
      SOL: data["SOL"]?.uiAmount || 0,
      USDC: data[USDC_MINT]?.uiAmount || 0,
    });
  };

  useEffect(() => {
    if (!activeWalletAccount) return;
    fetchBalances();
  }, [activeWalletAccount]);

  const handleLogout = () => {
    setActiveWalletAccount(null);
    logout();
  };

  const handleFlip = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleFromAmountChange = async (value: string) => {
    setFromAmount(value);
    if (!value) {
      setToAmount("");
      return;
    }
    try {
      const inputMint = fromToken === "USDC" ? USDC_MINT : SOL_MINT;
      const outputMint = toToken === "USDC" ? USDC_MINT : SOL_MINT;
      const amount = parseFloat(value) * (fromToken === "USDC" ? 1e6 : 1e9);
      const data = await getUltraQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps: 50,
      });
      const outAmt =
        fromToken === "USDC" ? data.outAmount / 1e9 : data.outAmount / 1e6;
      setToAmount(outAmt.toFixed(4));
    } catch {
      setToAmount("");
    }
  };

  const handleUltraSwap = async () => {
    if (!activeWalletAccount || !turnkeySigner) {
      setStatusMessage("❌ Please login and select an account");
      return;
    }

    try {
      setSwapping(true);
      setSwapModalOpen(true);
      const taker = new PublicKey(activeWalletAccount.address).toBase58();
      const orderResp = await createUltraOrder({
        inputMint: fromToken === "USDC" ? USDC_MINT : SOL_MINT,
        outputMint: fromToken === "USDC" ? SOL_MINT : USDC_MINT,
        amount:
          fromToken === "USDC"
            ? Math.floor(parseFloat(fromAmount) * 1e6)
            : Math.floor(parseFloat(fromAmount) * 1e9),
        slippageBps: 50,
        taker,
      });
      const { requestId, transaction: unsignedBase64 } = orderResp;
      if (!requestId || !unsignedBase64)
        throw new Error("Ultra order missing fields");
      const rawBytes = Uint8Array.from(atob(unsignedBase64), (c) =>
        c.charCodeAt(0),
      );
      const tx = VersionedTransaction.deserialize(rawBytes);
      await turnkeySigner.addSignature(tx, activeWalletAccount.address);
      const signedBase64 = Buffer.from(tx.serialize()).toString("base64");
      const execResp = await executeUltraOrder({
        requestId,
        signedTransaction: signedBase64,
      });
      const txid = execResp.signature;
      setSwapHash(txid);
      setStatusMessage(`✅ Swap successful`);
    } catch (err: any) {
      setStatusMessage(`❌ Error: ${err.message}`);
    } finally {
      setSwapping(false);

      setTimeout(() => setSwapModalOpen(false), 5000);
      fetchBalances();
    }
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
                    {account.address.slice(0, 6) +
                      "…" +
                      account.address.slice(-4)}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h1 className="text-2xl font-bold text-black mb-6">Swap</h1>

              <div className="flex justify-between mb-3 text-sm text-gray-600">
                <span>
                  Balance: {balances[fromToken].toFixed(4)} {fromToken}
                </span>
                <span>
                  Balance: {balances[toToken].toFixed(4)} {toToken}
                </span>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">You pay</span>
                </div>
                <div className="relative flex items-center bg-gray-50">
                  <input
                    type="number"
                    value={fromAmount}
                    onChange={(e) => handleFromAmountChange(e.target.value)}
                    placeholder="0.00"
                    className="bg-transparent text-3xl font-semibold text-black outline-none flex-1 placeholder:text-gray-300 pr-16 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />

                  <div className="absolute right-3 flex items-center gap-2 bg-white rounded-lg px-4 py-2 border border-gray-200">
                    <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">
                      {fromToken === "USDC" ? "$" : <SolIcon />}
                    </div>
                    <span className="text-black font-semibold text-base">
                      {fromToken}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center -my-3 relative z-10">
                <button
                  onClick={handleFlip}
                  className="bg-white hover:bg-gray-50 border-4 border-white rounded-xl p-2 transition-all hover:scale-110 active:scale-95 shadow-sm ring-1 ring-gray-200"
                >
                  <svg
                    className="w-5 h-5 text-black"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                </button>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">You receive</span>
                </div>
                <div className="relative flex items-center bg-gray-50">
                  <input
                    type="number"
                    value={toAmount}
                    placeholder="0.00"
                    className="bg-transparent text-3xl font-semibold text-black outline-none flex-1 placeholder:text-gray-300 pr-16 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />

                  <div className="absolute right-3 flex items-center gap-2 bg-white rounded-lg px-4 py-2 border border-gray-200">
                    <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">
                      {toToken === "USDC" ? "$" : <SolIcon />}
                    </div>
                    <span className="text-black font-semibold text-base">
                      {toToken}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleUltraSwap}
                disabled={swapping}
                className="w-full mt-6 bg-black hover:bg-gray-800 text-white font-semibold py-4 rounded-xl transition-all active:scale-98"
              >
                {swapping ? "Swapping…" : "Swap"}
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

      {swapModalOpen && (
        <div className="absolute inset-0 bg-white bg-opacity-95 backdrop-blur-sm rounded-2xl flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-6 p-8">
            {swapping ? (
              <>
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-black mb-1">
                    Sending transaction...
                  </h2>
                  <p className="text-sm text-gray-600">
                    Please wait while your swap is confirmed
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
                    Swap successful
                  </h2>
                  <p className="text-sm text-gray-600">
                    Your transaction has been completed
                  </p>
                  {swapHash && (
                    <a
                      href={`https://solscan.io/tx/${swapHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600"
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
