"use client";

import { useState } from "react";
import {
  useTurnkey,
  Wallet,
  WalletAccount,
} from "@turnkey/react-wallet-kit";
import { VersionedTransaction, PublicKey } from "@solana/web3.js";
import { TurnkeySigner } from "@turnkey/solana";
import { createUltraOrder, executeUltraOrder } from "../actions/jupiter";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export default function JupiterSwapPage() {
  const [activeWalletAccount, setActiveWalletAccount] = useState<WalletAccount | null>(null);
  const [status, setStatus] = useState<string>("");

  const { wallets, httpClient, handleLogin, logout, session } = useTurnkey();

  const turnkeySigner = activeWalletAccount
    ? new TurnkeySigner({
        organizationId: activeWalletAccount.organizationId,
        client: httpClient!,
      })
    : null;

  const handleLogout = () => {
    setActiveWalletAccount(null);
    logout();
    setStatus("");
  };

  const handleUltraSwap = async (fromMint: string, toMint: string, amount: number) => {
    try {
      if (!activeWalletAccount || !turnkeySigner) {
        setStatus("❌ No active account selected");
        return;
      }

      let taker: string;
      try {
        taker = new PublicKey(activeWalletAccount.address).toBase58();
      } catch {
        throw new Error("❌ Active account is not a valid Solana address");
      }

      setStatus("Creating Ultra order…");
      const orderResp = await createUltraOrder({
        inputMint: fromMint,
        outputMint: toMint,
        amount,
        slippageBps: 50,
        taker,
      });

      const { requestId, transaction: unsignedBase64 } = orderResp;
      if (!requestId || !unsignedBase64) {
        throw new Error("Ultra order missing fields");
      }

      // Deserialize unsigned tx
      const rawBytes = Uint8Array.from(atob(unsignedBase64), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(rawBytes);

      // Sign
      await turnkeySigner.addSignature(tx, activeWalletAccount.address);

      // Serialize back to base64
      const signedBase64 = Buffer.from(tx.serialize()).toString("base64");

      setStatus("Executing Ultra order…");
      const execResp = await executeUltraOrder({ requestId, signedTransaction: signedBase64 });

      const txid = execResp.signature;
      setStatus(
        `✅ Swap broadcasted. <a href="https://solscan.io/tx/${txid}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">${txid}</a>`
      );
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-4 gap-4 pt-40">
      <div className="flex items-center relative mb-4">
        <h1 className="w-full text-center text-lg">
          Turnkey x Jupiter Ultra Swap Demo
        </h1>
      </div>

      <div className="flex gap-2">
        {session && (
          <div>
            <button
              onClick={() => handleUltraSwap(USDC_MINT, SOL_MINT, 100_000)}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Swap 0.1 USDC → SOL
            </button>
            <button
              onClick={() => handleUltraSwap(SOL_MINT, USDC_MINT, 100_000)}
              className="bg-blue-600 text-white px-4 py-2 rounded ml-2"
            >
              Swap 0.0001 SOL → USDC
            </button>
          </div>
        )}
      </div>

      {status && (
        <p
          className="text-sm mt-2"
          dangerouslySetInnerHTML={{ __html: status }}
        />
      )}

      <div className="flex flex-col items-center">
        {wallets && wallets.length > 0 && (
          <>
            <h3 className="mb-2">Select Wallet Account</h3>
            {wallets.map((w: Wallet) =>
              w.accounts.map((acct: WalletAccount) => (
                <button
                  key={acct.address}
                  onClick={() => setActiveWalletAccount(acct)}
                  className={`block w-[500px] text-left px-2 py-1 border rounded mt-1 ${
                    activeWalletAccount?.address === acct.address ? "bg-gray-200" : ""
                  }`}
                >
                  {acct.address}
                </button>
              ))
            )}
          </>
        )}

        {!wallets?.length && <p>No wallets available. Log in first.</p>}

        {session ? (
          <button
            onClick={handleLogout}
            className="bg-purple-600 text-white px-4 py-2 rounded mt-2"
          >
            Log out of Turnkey
          </button>
        ) : (
          <button
            onClick={() => handleLogin()}
            className="bg-purple-600 text-white px-4 py-2 rounded mt-2"
          >
            Login with Turnkey
          </button>
        )}
      </div>
    </main>
  );
}
