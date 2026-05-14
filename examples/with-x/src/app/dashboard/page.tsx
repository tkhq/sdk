"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AuthState, ClientState, useTurnkey } from "@turnkey/react-wallet-kit";
import { CopyIcon } from "../../components/ui/CopyIcon";
import { SolanaIcon } from "../../components/ui/SolanaIcon";
import { LogoutButton } from "../../components/LogoutButton";

export default function Dashboard() {
  const router = useRouter();
  const {
    authState,
    clientState,
    user,
    wallets,
  } = useTurnkey();

  useEffect(() => {
    if (clientState !== ClientState.Ready) return;

    if (authState === AuthState.Unauthenticated) {
      router.push("/");
    }
  }, [authState, clientState, router]);

  const walletName = "My Solana Wallet";
  const userId = user?.userId ?? "00000000-0000-0000-0000-000000000000";
  const walletAddress =
    wallets[0]?.accounts?.find(
      (a) => a.addressFormat === "ADDRESS_FORMAT_SOLANA",
    )?.address ??
    wallets[0]?.accounts?.[0]?.address ??
    "0x";

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
              <CopyIcon text={userId} title="Copy User ID" />
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Wallet Information
            </h2>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <SolanaIcon />
                <div>
                  <p className="text-foreground font-medium">{walletName}</p>
                  <p className="text-sm text-muted-foreground">Solana Wallet</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-mono text-sm truncate overflow-hidden max-w-[200px]">
                  {walletAddress}
                </span>
                <CopyIcon text={walletAddress} title="Copy Wallet Address" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
