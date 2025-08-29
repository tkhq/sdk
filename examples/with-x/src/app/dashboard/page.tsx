"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/Image";
import { useRouter } from "next/navigation";
import { useTurnkey } from "@turnkey/sdk-react";

export default function Dashboard() {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const router = useRouter();
  const indexedDbInitialized = useRef(false);
  const [userId, setUserId] = useState<string>(
    "00000000-0000-0000-0000-000000000000",
  );
  const [walletAddress, setWalletAddress] = useState<string>("0x");
  const { indexedDbClient } = useTurnkey();

  const walletName = "My Solana Wallet";

  useEffect(() => {
    const getAccountInfo = async () => {
      if (indexedDbClient !== undefined && !indexedDbInitialized.current) {
        indexedDbInitialized.current = true;

        try {
          const whoamIResponse = await indexedDbClient.getWhoami();
          setUserId(whoamIResponse.userId);

          const getWalletsResponse = await indexedDbClient.getWallets({
            organizationId: whoamIResponse.organizationId,
          });

          const getWalletAccountsResponse =
            await indexedDbClient.getWalletAccounts({
              organizationId: whoamIResponse.organizationId,
              walletId: getWalletsResponse.wallets[0].walletId,
            });

          setWalletAddress(getWalletAccountsResponse.accounts[0].address);
        } catch (e) {
          console.error("Failed obtaining account information");
        }
      }
    };

    getAccountInfo();
  }, [indexedDbClient]);

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleLogout = () => {
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <Image src="/turnkey.png" alt="Turnkey Logo" width={64} height={64} />
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome to your wallet dashboard
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              User Information
            </h2>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  User ID
                </label>
                <p className="text-foreground font-mono">{userId}</p>
              </div>
              <button
                onClick={() => copyToClipboard(userId, "userId")}
                className="p-2 hover:bg-muted rounded transition-colors"
                title="Copy User ID"
              >
                {copiedField === "userId" ? (
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Wallet Information
            </h2>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6" viewBox="0 0 397.7 311.7" fill="none">
                  <linearGradient
                    id="solanaGradient"
                    x1="360.8791"
                    y1="351.4553"
                    x2="141.213"
                    y2="-69.2936"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0" stopColor="#00FFA3" />
                    <stop offset="1" stopColor="#DC1FFF" />
                  </linearGradient>
                  <path
                    d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 237.9z"
                    fill="url(#solanaGradient)"
                  />
                  <path
                    d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"
                    fill="url(#solanaGradient)"
                  />
                  <path
                    d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
                    fill="url(#solanaGradient)"
                  />
                </svg>
                <div>
                  <p className="text-foreground font-medium">{walletName}</p>
                  <p className="text-sm text-muted-foreground">Solana Wallet</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-mono text-sm">
                  {walletAddress}
                </span>
                <button
                  onClick={() => copyToClipboard(walletAddress, "walletId")}
                  className="p-2 hover:bg-muted rounded transition-colors"
                  title="Copy Wallet ID"
                >
                  {copiedField === "walletId" ? (
                    <svg
                      className="w-4 h-4 text-green-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
          >
            Log Out
          </button>
        </div>
      </div>
    </main>
  );
}
