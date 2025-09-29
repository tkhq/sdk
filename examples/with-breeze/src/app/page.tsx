"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  useTurnkey,
  Wallet,
  WalletAccount,
} from "@turnkey/react-wallet-kit";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { BreezeSDK } from "@breezebaby/breeze-sdk";
import { TurnkeySigner } from "@turnkey/solana";

// Choose a public RPC (can be mainnet or devnet depending on Breeze env)
const connection = new Connection(
  "https://solana-rpc.publicnode.com",
  "confirmed"
);

// Breeze setup
const breeze = new BreezeSDK({
  apiKey: process.env.NEXT_PUBLIC_BREEZE_API_KEY!,
  baseUrl: "https://api.breeze.baby",
  timeout: 30000,
});

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export default function AuthPage() {
  const [activeWalletAccount, setActiveWalletAccount] =
    useState<WalletAccount | null>(null);
  const [status, setStatus] = useState("");
  const [balances, setBalances] = useState<any[]>([]);
  const [yieldInfo, setYieldInfo] = useState<any[]>([]);

  // hook provides session + wallet context
  const { wallets, httpClient, handleLogin, logout } = useTurnkey();

  // Create a signer bound to current Turnkey org/session
  const turnkeySigner = activeWalletAccount
    ? new TurnkeySigner({
        organizationId: activeWalletAccount.organizationId,
        client: httpClient!,
      })
    : null;

    useEffect(() => {
      if (activeWalletAccount) {
        fetchUserInfo()
      }
    }, [activeWalletAccount]);


// Breeze deposit flow
const handleDeposit = async () => {
  try {
    if (!activeWalletAccount || !turnkeySigner) {
      setStatus("❌ No active account selected");
      return;
    }

    setStatus("Creating deposit transaction…");

    const depositTxB64 = await breeze.createDepositTransaction({
      payerKey: activeWalletAccount.address,
      fundId: process.env.NEXT_PUBLIC_FUND_ID!,
      userKey: activeWalletAccount.address,
      amount: 1_000_000, // 1 USDC (6 decimals)
      mint: USDC_MINT,
    });

    const rawBytes = Uint8Array.from(atob(depositTxB64), (c) =>
      c.charCodeAt(0)
    );
    const transaction = VersionedTransaction.deserialize(rawBytes);

    await turnkeySigner.addSignature(transaction, activeWalletAccount.address);

    const allSigsPresent = transaction.signatures.every(
      (sig) => sig !== null && sig.length > 0
    );
    if (!allSigsPresent) {
      throw new Error("Signature verification failed");
    }

    const txid = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    await connection.confirmTransaction(txid, "confirmed");

    setStatus(`✅ Deposit broadcasted. Transaction ID: ${txid}`);

    // 🔑 refresh Breeze balances/yield after deposit
    await fetchUserInfo();
  } catch (err: any) {
    console.error(err);
    setStatus(`❌ Error: ${err.message}`);
  }
};

// Breeze withdraw flow
const handleWithdraw = async () => {
  try {
    if (!activeWalletAccount || !turnkeySigner) {
      setStatus("❌ No active account selected");
      return;
    }

    setStatus("Creating withdraw transaction…");

    const withdrawTxB64 = await breeze.createWithdrawTransaction({
      payerKey: activeWalletAccount.address,
      fundId: process.env.NEXT_PUBLIC_FUND_ID!,
      userKey: activeWalletAccount.address,
      amount: 1_000_000, // 1 USDC
    });

    const rawBytes = Uint8Array.from(atob(withdrawTxB64), (c) =>
      c.charCodeAt(0)
    );
    const transaction = VersionedTransaction.deserialize(rawBytes);

    await turnkeySigner.addSignature(transaction, activeWalletAccount.address);

    const allSigsPresent = transaction.signatures.every(
      (sig) => sig !== null && sig.length > 0
    );
    if (!allSigsPresent) {
      throw new Error("Signature verification failed");
    }

    const txid = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    await connection.confirmTransaction(txid, "confirmed");

    setStatus(`✅ Withdrawal broadcasted. Transaction ID: ${txid}`);

    // 🔑 refresh Breeze balances/yield after withdraw
    await fetchUserInfo();
  } catch (err: any) {
    console.error(err);
    setStatus(`❌ Error: ${err.message}`);
  }
};


  // Fetch balances + yield
  const fetchUserInfo = async () => {
    if (!activeWalletAccount) return;
    try {
      const userId = activeWalletAccount.address; // can also use Breeze userId if different
      const userBalances = await breeze.getUserBalances({ userId });
      const userYield = await breeze.getUserYield({ userId });
      console.log(userBalances.data)
      setBalances(userYield.data || []);
      setYieldInfo(userYield.data || []);
    } catch (err) {
      console.error("Error fetching user info", err);
    }
  };

  useEffect(() => {
    if (activeWalletAccount) {
      fetchUserInfo();
    }
  }, [activeWalletAccount]);

  return (
    <main className="p-4 flex flex-col gap-4">
      <div className="flex items-center relative mb-4">
        <a
          href="https://www.turnkey.com"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-1/2 -translate-y-1/2"
        >
          <Image
            src="/logo.svg"
            alt="Turnkey Logo"
            width={100}
            height={24}
            priority
          />
        </a>
        <h1 className="w-full text-center text-lg">
          Turnkey + Breeze Staking Playground
        </h1>
      </div>

      <div>
        <h2>Breeze Actions</h2>
        <div className="flex gap-2">
          <button
            onClick={handleDeposit}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Deposit 1 USDC
          </button>
          <button
            onClick={handleWithdraw}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Withdraw 1 USDC
          </button>
          <button
            onClick={fetchUserInfo}
            className="bg-gray-600 text-white px-4 py-2 rounded"
          >
            Refresh Balances/Yield
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
      </div>

      <div>
        <h2 className="font-bold">User Balances</h2>
        {balances.length > 0 ? (
          <ul className="list-disc ml-5">
            {balances.map((bal: any) => (
              <li key={bal.fund_id}>
                {bal.position_value / 1_000_000} {bal.base_asset}{" "}
              </li>
            ))}
          </ul>
        ) : (
          <p>No balances available.</p>
        )}

        <h2 className="font-bold mt-4">User Yield</h2>
        {yieldInfo.length > 0 ? (
          <ul className="list-disc ml-5">
            {yieldInfo.map((y: any) => (
              <li key={y.funx_id}>
                {y.yield_earned / 1_000_000} {y.base_asset}{" "}
              </li>
            ))}
          </ul>
        ) : (
          <p>No yield info available.</p>
        )}
      </div>

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
