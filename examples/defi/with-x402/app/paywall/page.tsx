"use client";

import { AuthState, ClientState, useTurnkey } from "@turnkey/react-wallet-kit";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAccount } from "@turnkey/viem";
import { createWalletClient, http, sha256, type Account } from "viem";
import { baseSepolia } from "viem/chains";
import { exact } from "x402/schemes";
import { PAYMENT_AMOUNT, USDC_ADDRESS } from "../constants";

export default function PaymentClient() {
  const {
    authState,
    clientState,
    user,
    session,
    wallets,
    httpClient, // @turnkey/viem needs a Turnkey HTTP client to access the Turnkey API
    handleLogin,
    logout,
  } = useTurnkey();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const walletAddress = wallets[0]?.accounts[0]?.address;
  const organizationId = session?.organizationId;

  // The signing code below creates an EIP-3009 TransferWithAuthorization signature using Turnkey's Viem integration.
  // This signature is then encoded into an x402 payment header which is sent to the server for verification and settlement.
  // If the payment is successful, a cookie is set by the server allowing access to the protected content.
  const handlePayment = async () => {
    if (
      authState !== AuthState.Authenticated ||
      !wallets ||
      wallets.length === 0
    ) {
      setError("Please sign in first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // This code was adapted from Turnkey's with-viem example. See examples/with-viem/src/eip712/erc3009_transfer.ts for the example.

      // Create Turnkey Viem account
      const turnkeyAccount = await createAccount({
        client: httpClient!,
        organizationId: organizationId!,
        signWith: walletAddress,
        ethereumAddress: walletAddress,
      });

      // Create Viem wallet client
      const client = createWalletClient({
        account: turnkeyAccount as Account,
        chain: baseSepolia,
        transport: http(),
      });

      // Define EIP-712 domain for USDC on Base Sepolia
      const domain = {
        name: "USDC",
        version: "2",
        chainId: baseSepolia.id,
        verifyingContract: USDC_ADDRESS as `0x${string}`,
      } as const;

      // Define the types for EIP-3009 TransferWithAuthorization
      const types = {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      } as const;

      // Generate a random nonce
      const nonce = sha256(crypto.getRandomValues(new Uint8Array(32)));

      // Set validity period (valid for 5 minutes from now)
      const validAfter = BigInt(0);
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + 300);

      // Get the payTo address from environment or use a default
      const payToAddress =
        process.env.NEXT_PUBLIC_RESOURCE_WALLET_ADDRESS ||
        "0x0000000000000000000000000000000000000000";

      // Create the message
      const message = {
        from: walletAddress as `0x${string}`,
        to: payToAddress as `0x${string}`,
        value: BigInt(PAYMENT_AMOUNT),
        validAfter,
        validBefore,
        nonce,
      };

      // Sign the typed data using Turnkey
      const signature = await client.signTypedData({
        account: turnkeyAccount as Account,
        domain,
        types,
        primaryType: "TransferWithAuthorization",
        message,
      });

      console.log("Signature:", signature);

      // Encode the payment using x402
      const encodedPayment = exact.evm.encodePayment({
        scheme: "exact",
        network: "base-sepolia",
        x402Version: 1,
        payload: {
          signature,
          authorization: {
            from: walletAddress,
            to: payToAddress,
            value: PAYMENT_AMOUNT,
            validAfter: validAfter.toString(),
            validBefore: validBefore.toString(),
            nonce,
          },
        },
      });

      // Fetch the server route to verify payment using the facilitator. If successful, a cookie will be set indicating that payment has been made.
      const result = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentHeader: encodedPayment }),
      });

      if (result.status === 200) {
        // Payment successful, redirect to protected content. By now, the server has set a cookie so the middleware will allow us to access the protected route.
        router.push("/protected");
      } else if (!result?.ok) {
        const data = await result.json();
        throw new Error(data.error);
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to process payment",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-800">
      {clientState === ClientState.Error && (
        <div className="text-red-500">
          Something went wrong, try reloading the page. Did you set your .env
          vars correctly?
        </div>
      )}

      {!clientState ||
        (clientState === ClientState.Loading && (
          <div className="text-white flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Turnkey is loading...
          </div>
        ))}

      {clientState === ClientState.Ready && (
        <div className="max-w-2xl mx-auto p-8 bg-slate-200 rounded-lg shadow-lg">
          <h1 className="text-4xl font-bold">Payment Required</h1>
          <p className="text-lg mb-2 mt-2">
            This content requires a payment of 0.01 Base Sepolia USDC to access.
          </p>

          {authState === AuthState.Unauthenticated ? (
            <div className="space-y-4">
              <p className="text-gray-600">
                Please sign in with Turnkey to make the payment using your
                embedded wallet.
              </p>
              <button
                onClick={() => handleLogin()}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
              >
                Sign in with Turnkey
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="gap-1 flex flex-col">
                <p className="text-gray-600">
                  Turnkey user name: {user?.userName || "User"}
                </p>
                <div className="flex flex-row gap-2 items-center">
                  <p className="text-gray-600">
                    {"Turnkey wallet address: "}
                    {walletAddress?.slice(0, 6)}...
                    {walletAddress?.slice(-4)}
                  </p>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(walletAddress);
                    }}
                    className="text-blue-500 underline text-sm"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-gray-600 text-xs italic mt-1">
                  Want to use a different Turnkey sub-organization?{" "}
                  <button
                    onClick={async () => await logout()}
                    className="underline text-red-500/80"
                  >
                    Logout.
                  </button>
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600">{error}</p>
                </div>
              )}

              <div className="flex flex-col gap-2 justify-center items-center">
                <button
                  onClick={handlePayment}
                  disabled={loading || !wallets || wallets.length === 0}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
                >
                  {loading
                    ? "Processing payment..."
                    : "Pay 0.01 USDC with Turnkey Wallet"}
                </button>
                <p className="text-gray-600 text-xs italic">
                  Need Base Sepolia USDC? Get some{" "}
                  <a
                    className="underline"
                    href="https://faucet.circle.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    here.
                  </a>
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Payment Details:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Amount: 0.01 USDC</li>
              <li>Network: Base Sepolia</li>
              <li>Asset: {USDC_ADDRESS}</li>
              <li className="break-all">
                Pay To:{" "}
                {process.env.NEXT_PUBLIC_RESOURCE_WALLET_ADDRESS ||
                  "Not configured"}
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
