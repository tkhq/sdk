"use client";

import { useTurnkey } from "@turnkey/react-wallet-kit";
import { useState, useEffect, type ReactElement } from "react";
import {
  Horizon,
  NetworkError,
  StrKey,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
  Keypair,
  xdr,
  hash,
} from "@stellar/stellar-sdk";

const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";

export default function SendTransaction(): ReactElement {
  const { wallets, httpClient } = useTurnkey();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("10");
  const [balance, setBalance] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [funding, setFunding] = useState(false);

  const stellarAccount = wallets
    .flatMap((w) => w.accounts)
    .find((a) => a.addressFormat === "ADDRESS_FORMAT_XLM");

  useEffect(() => {
    if (stellarAccount?.address) {
      fetchBalance(stellarAccount.address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stellarAccount?.address]);

  async function fetchBalance(address: string) {
    try {
      const server = new Horizon.Server(HORIZON_TESTNET);
      const account = await server.loadAccount(address);
      const xlm = account.balances.find((b) => b.asset_type === "native");
      setBalance(xlm ? `${xlm.balance} XLM` : "0 XLM");
    } catch {
      setBalance("Account not funded yet");
    }
  }

  async function handleFund() {
    if (!stellarAccount?.address) return;
    setFunding(true);
    setError(null);
    try {
      const res = await fetch(
        `${FRIENDBOT_URL}/?addr=${stellarAccount.address}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          title?: string;
          detail?: string;
          extras?: { invalid_field?: string; reason?: string };
        } | null;
        const extras = body?.extras;
        if (extras?.reason) {
          setError(
            extras.invalid_field
              ? `${extras.invalid_field}: ${extras.reason}`
              : extras.reason,
          );
        } else {
          setError(body?.detail ?? body?.title ?? "Friendbot funding failed.");
        }
        return;
      }
      await fetchBalance(stellarAccount.address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Funding failed.");
    } finally {
      setFunding(false);
    }
  }

  async function handleSend() {
    if (!stellarAccount) {
      setError("No Stellar account found.");
      return;
    }
    if (!httpClient) {
      setError("Client not initialized.");
      return;
    }
    if (!StrKey.isValidEd25519PublicKey(destination)) {
      setError("Invalid destination address.");
      return;
    }
    if (parseFloat(amount) < 0.0000001) {
      setError("Amount must be at least 0.0000001 XLM.");
      return;
    }
    setError(null);
    setTxHash(null);
    setLoading(true);

    try {
      const server = new Horizon.Server(HORIZON_TESTNET);
      const sourceAccount = await server.loadAccount(stellarAccount.address);

      const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination,
            asset: Asset.native(),
            amount,
          }),
        )
        .setTimeout(30)
        .build();

      // Compute the transaction hash (SHA-256 of the signature base).
      // `hash()` is declared against @stellar/stellar-base's own bundled Buffer;
      // `as unknown as Parameters<typeof hash>[0]` avoids the cross-package
      // Buffer type conflict without widening to `any`.
      const txHashBytes = hash(
        tx.signatureBase() as unknown as Parameters<typeof hash>[0],
      );
      const txHashHex = Array.from(txHashBytes as unknown as Uint8Array)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Sign the raw 32-byte hash directly. signMessage() re-encodes the
      // message string as UTF-8 bytes before sending, which would sign the
      // ASCII representation of the hex string instead of the binary hash.
      // signRawPayload() treats the payload as already-encoded hex bytes.
      const { r, s } = await httpClient.signRawPayload({
        signWith: stellarAccount.address,
        payload: txHashHex,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      });

      // Reconstruct the 64-byte ed25519 signature from r and s
      const rHex = r.startsWith("0x") ? r.slice(2) : r;
      const sHex = s.startsWith("0x") ? s.slice(2) : s;
      const sigHex = rHex.padStart(64, "0") + sHex.padStart(64, "0");
      const signatureBytes = Uint8Array.from(
        sigHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
      );

      // Attach signature to transaction. Keypair is constructed solely to call
      // signatureHint(), which returns the last 4 bytes of the raw public key,
      //   a discriminator Horizon uses to match signatures to signers.
      const keypair = Keypair.fromPublicKey(stellarAccount.address);
      type DecoratedSigArgs = ConstructorParameters<
        typeof xdr.DecoratedSignature
      >[0];
      const decorated = new xdr.DecoratedSignature({
        hint: keypair.signatureHint(),
        signature: signatureBytes as unknown as DecoratedSigArgs["signature"],
      });
      tx.signatures.push(decorated);

      const result = await server.submitTransaction(tx);
      setTxHash(result.hash);
      await fetchBalance(stellarAccount.address);
    } catch (err) {
      const horizonError =
        err instanceof NetworkError
          ? (
              err.response.data as
                | Horizon.HorizonApi.ErrorResponseData.TransactionFailed
                | undefined
            )?.extras?.result_codes
          : undefined;
      if (horizonError) {
        setError(JSON.stringify(horizonError));
      } else {
        setError(err instanceof Error ? err.message : "Transaction failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">
      <h2 className="font-semibold text-lg">Send Transaction</h2>

      {stellarAccount && (
        <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-100 p-3 text-sm">
          <span className="text-gray-500">
            Balance:{" "}
            <span className="text-gray-900 font-medium">
              {balance ?? "Loading…"}
            </span>
          </span>
          <button
            onClick={handleFund}
            disabled={funding}
            className="text-xs px-3 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 cursor-pointer transition-colors"
          >
            {funding ? "Funding…" : "Fund with Friendbot"}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">Destination Address</label>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="G..."
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">Amount (XLM)</label>
          <input
            value={amount}
            onChange={(e) => {
              const val = e.target.value;
              if ((val.split(".")[1] ?? "").length <= 7) setAmount(val);
            }}
            type="number"
            min="0.0000001"
            step="0.0000001"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="10"
          />
        </div>
      </div>

      <button
        onClick={handleSend}
        disabled={loading || !stellarAccount || !destination || !amount}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
      >
        {loading ? "Sending…" : "Send Transaction"}
      </button>

      {!stellarAccount && (
        <p className="text-sm text-amber-600">No Stellar account found.</p>
      )}

      {error && (
        <p className="text-sm text-red-500 break-all">Error: {error}</p>
      )}

      {txHash && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-green-600 font-medium">
            Transaction confirmed!
          </p>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-blue-600 underline underline-offset-2 break-all"
          >
            {txHash}
          </a>
        </div>
      )}
    </section>
  );
}
