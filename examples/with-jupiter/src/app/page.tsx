"use client";

import { useState } from "react";
import {
  useTurnkey,
  Wallet,
  WalletAccount,
} from "@turnkey/react-wallet-kit";
import { Connection, VersionedTransaction, PublicKey } from "@solana/web3.js";
import { TurnkeySigner } from "@turnkey/solana";

const connection = new Connection(
  "https://solana-rpc.publicnode.com",
  "confirmed"
);

// Jupiter API endpoint
const JUPITER_API = "https://quote-api.jup.ag/v6";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export default function JupiterSwapPage() {
  const [activeWalletAccount, setActiveWalletAccount] =
    useState<WalletAccount | null>(null);
  const [status, setStatus] = useState("");

  const { wallets, httpClient, handleLogin, logout } = useTurnkey();

  const turnkeySigner = activeWalletAccount
    ? new TurnkeySigner({
        organizationId: activeWalletAccount.organizationId,
        client: httpClient!,
      })
    : null;

  // Generic Jupiter swap
  const handleSwap = async (fromMint: string, toMint: string, amount: number) => {
    try {
      if (!activeWalletAccount || !turnkeySigner) {
        setStatus("❌ No active account selected");
        return;
      }

      setStatus("Fetching Jupiter quote…");

      // Jupiter quote
      const quoteResp = await fetch(
        `${JUPITER_API}/quote?inputMint=${fromMint}&outputMint=${toMint}&amount=${amount}&slippageBps=50`
      );
      const quote = await quoteResp.json();
      if (!quote?.data || quote.data.length === 0) {
        throw new Error("No quote available");
      }
      const bestRoute = quote.data[0];

      // Jupiter swap transaction
      const swapResp = await fetch(`${JUPITER_API}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPublicKey: activeWalletAccount.address,
          route: bestRoute,
        }),
      });
      const swapData = await swapResp.json();

      if (!swapData.swapTransaction) {
        throw new Error("Failed to fetch swap transaction");
      }

      // Deserialize and sign
      const rawBytes = Uint8Array.from(atob(swapData.swapTransaction), (c) =>
        c.charCodeAt(0)
      );
      const transaction = VersionedTransaction.deserialize(rawBytes);

      await turnkeySigner.addSignature(transaction, activeWalletAccount.address);

      // Broadcast
      const txid = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      await connection.confirmTransaction(txid, "confirmed");

      setStatus(
        `✅ Swap broadcasted. Transaction ID: ${txid}`
      );
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  return (
    <main className="p-4 flex flex-col gap-4">
      <h1 className="text-lg">Turnkey + Jupiter Swap Playground</h1>

      <div className="flex gap-2">
        <button
          onClick={() => handleSwap(USDC_MINT, SOL_MINT, 1_000_000)} // 1 USDC
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Swap 1 USDC → SOL
        </button>
        <button
          onClick={() => handleSwap(SOL_MINT, USDC_MINT, 100_000_000)} // ~0.1 SOL (9 decimals)
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Swap 0.1 SOL → USDC
        </button>
      </div>

      {status && (
        <p className="text-sm mt-2">
          {status.includes("Transaction ID") ? (
            <span>
              {status.split("Transaction ID:")[0]}
              <a
                href={`https://solscan.io/tx/${status.split("Transaction ID:")[1].trim()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                {status.split("Transaction ID:")[1].trim()}
              </a>
            </span>
          ) : (
            status
          )}
        </p>
      )}

      <div>
        <h3>Select Wallet Account</h3>
        {wallets && wallets.length > 0 ? (
          wallets.map((w: Wallet) =>
            w.accounts.map((acct: WalletAccount) => (
              <button
                key={acct.address}
                onClick={() => setActiveWalletAccount(acct)}
                className={`block w-full text-left px-2 py-1 border rounded mt-1 ${
                  activeWalletAccount?.address === acct.address
                    ? "bg-gray-200"
                    : ""
                }`}
              >
                {acct.address}
              </button>
            ))
          )
        ) : (
          <p>No wallets available. Log in first.</p>
        )}
        <button
          onClick={() => handleLogin()}
          className="bg-purple-600 text-white px-4 py-2 rounded mt-2"
        >
          Login with Turnkey
        </button>
        <button
          onClick={() => logout()}
          className="bg-purple-600 text-white px-4 py-2 rounded mt-2"
        >
          Log out of Turnkey
        </button>
      </div>
    </main>
  );
}
