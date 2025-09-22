"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  OAuthProviders,
  v1AddressFormat,
  v1CreatePolicyIntentV3,
} from "@turnkey/sdk-types";
import {
  AuthState,
  Chain,
  ClientState,
  OtpType,
  useTurnkey,
  Wallet,
  WalletAccount,
  WalletSource,
} from "@turnkey/react-wallet-kit";
import { createAccount } from "@turnkey/viem";
import { createWalletClient, http, type Account } from "viem";
import { parseEther, Transaction as EthTransaction } from "ethers";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { BreezeSDK } from "@breezebaby/breeze-sdk";

// Breeze setup
const breeze = new BreezeSDK({
  apiKey: process.env.NEXT_PUBLIC_BREEZE_API_KEY!,
  baseUrl: "https://api.breeze.baby",
  timeout: 30000,
});
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export default function AuthPage() {
  const [email, setEmail] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [emailOtpCode, setEmailOtpCode] = useState<string>("");
  const [smsOtpCode, setSmsOtpCode] = useState<string>("");
  const [otpId, setOtpId] = useState<string>("");

  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState<string>("");
  const [activeWallet, setActiveWallet] = useState<Wallet | null>(null);
  const [activeWalletAccount, setActiveWalletAccount] =
    useState<WalletAccount | null>(null);
  const [status, setStatus] = useState("");

  const {
    httpClient,
    session,
    allSessions,
    clientState,
    authState,
    wallets,
    user,
    signTransaction,
  } = useTurnkey();

  const turnkey = useTurnkey();

  // Breeze actions
  const handleDeposit = async () => {
    try {
      if (!activeWalletAccount) {
        setStatus("❌ No active account selected");
        return;
      }
      setStatus("Creating deposit transaction…");

      const depositTx = await breeze.createDepositTransaction({
        fundId: process.env.NEXT_PUBLIC_FUND_ID!,
        userKey: activeWalletAccount.address,
        amount: 1_000_000, // 1 USDC
        mint: USDC_MINT,
      });

      const rawTx = Buffer.from(depositTx.transaction, "base64").toString(
        "hex",
      );

      setStatus("Signing & sending transaction…");
      const sig = await signTransaction({
        unsignedTransaction: rawTx,
        walletAccount: activeWalletAccount,
        transactionType: "TRANSACTION_TYPE_SOLANA",
      });

      setStatus(`✅ Deposit submitted. Signature: ${sig}`);
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  const handleWithdraw = async () => {
    try {
      if (!activeWalletAccount) {
        setStatus("❌ No active account selected");
        return;
      }
      setStatus("Creating withdraw transaction…");

      const withdrawTx = await breeze.createWithdrawTransaction({
        fundId: process.env.NEXT_PUBLIC_FUND_ID!,
        userKey: activeWalletAccount.address,
        amount: 1_000_000,
      });

      const rawTx = Buffer.from(withdrawTx.transaction, "base64").toString(
        "hex",
      );

      setStatus("Signing & sending transaction…");
      const sig = await signTransaction({
        unsignedTransaction: rawTx,
        walletAccount: activeWalletAccount,
        transactionType: "TRANSACTION_TYPE_SOLANA",
      });

      setStatus(`✅ Withdrawal submitted. Signature: ${sig}`);
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    }
  };

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
        </div>
        <p className="text-sm">{status}</p>
      </div>

      <div>
        <h3>Select Wallet Account</h3>
        {wallets && wallets.length > 0 ? (
          wallets.map((w) =>
            w.accounts.map((acct) => (
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
            )),
          )
        ) : (
          <p>No wallets available. Log in first.</p>
        )}
        <button
          onClick={() => turnkey.handleLogin()}
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          Login with Turnkey
        </button>
      </div>
    </main>
  );
}
