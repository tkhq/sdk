"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  AuthState,
  ExportType,
  useModal,
  useTurnkey,
  Wallet,
  WalletAccount,
  WalletSource,
} from "@turnkey/react-wallet-kit";
import { v1PrivateKey } from "@turnkey/sdk-types";
import { DecryptWithPassphraseComponent } from "../components/DecryptWithPassphrase";
import { ExportWithPassphraseComponent } from "../components/ExportWithPassphrase";

export default function Home() {
  const { httpClient, wallets, authState, handleLogin, createWallet, logout } =
    useTurnkey();

  const { pushPage } = useModal();

  // ── State ──────────────────────────────────────────────────────────────
  const [activeWallet, setActiveWallet] = useState<Wallet | null>(null);

  const [privateKeys, setPrivateKeys] = useState<v1PrivateKey[]>([]);
  const [activePrivateKey, setActivePrivateKey] = useState<v1PrivateKey | null>(
    null,
  );

  // ── Callbacks ──────────────────────────────────────────────────────────
  const handleCreateWallet = useCallback(async () => {
    await createWallet({
      walletName: "Solana Wallet " + new Date().toISOString(),
      accounts: ["ADDRESS_FORMAT_SOLANA", "ADDRESS_FORMAT_ETHEREUM"],
    });
  }, [createWallet]);

  const handleCreateSolPrivateKey = useCallback(async () => {
    await httpClient?.createPrivateKeys({
      privateKeys: [
        {
          privateKeyName: "Private Key " + new Date().toISOString(),
          curve: "CURVE_ED25519",
          privateKeyTags: [],
          addressFormats: ["ADDRESS_FORMAT_SOLANA"],
        },
      ],
    });

    handleGetPrivateKeys();
  }, [httpClient, setPrivateKeys]);

  const handleGetPrivateKeys = useCallback(async () => {
    const privateKeys = (await httpClient?.getPrivateKeys())?.privateKeys;
    setPrivateKeys(privateKeys || []);
  }, [httpClient, setPrivateKeys]);

  useEffect(() => {
    if (authState === AuthState.Authenticated) {
      handleGetPrivateKeys();
    }
  }, [authState, handleGetPrivateKeys]);

  // ── Effects ────────────────────────────────────────────────────────────
  return (
    <main className="p-4 flex flex-col gap-4 justify-center min-h-screen items-center">
      {authState == AuthState.Unauthenticated ? (
        <div className="flex flex-col gap-4 items-center">
          <p>Please log in to see your wallets and test export and sign.</p>
          <button onClick={() => handleLogin()}>Login</button>
        </div>
      ) : (
        <>
          <p>Welcome! You are logged in.</p>

          <button
            className="bg-neutral-300 text-black"
            onClick={handleCreateWallet}
          >
            Create Wallet
          </button>

          <div className="flex flex-wrap gap-2">
            {wallets && wallets.length > 0
              ? wallets.map((wallet: Wallet) => {
                  if (wallet.source === WalletSource.Embedded)
                    return (
                      <div
                        key={wallet.walletId}
                        className="p-3 text-sm border border-neutral-700 bg-neutral-900 rounded justify-between flex flex-col"
                      >
                        <div>
                          <p className="truncate">
                            Wallet ID: <span>{wallet.walletId}</span>
                          </p>
                          <p className="truncate">
                            Wallet Name: <span>{wallet.walletName}</span>
                          </p>
                          <p className="truncate mt-3">Accounts:</p>
                          <div className="flex flex-col mt-1">
                            {wallet.accounts.map((account, i) => {
                              return (
                                <div
                                  className="text-left"
                                  key={account.address}
                                >
                                  <span>{account.address}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <button
                          onClick={() => setActiveWallet(wallet)}
                          className={`transition-all  mt-auto p-1 rounded w-full text-xs ${activeWallet?.walletId !== wallet.walletId ? "bg-blue-600" : "bg-neutral-600"}`}
                          disabled={activeWallet?.walletId === wallet.walletId}
                        >
                          {activeWallet?.walletId === wallet.walletId
                            ? "Active"
                            : "Set Active"}
                        </button>
                      </div>
                    );
                })
              : null}
          </div>

          <button
            data-testid="show-export-wallet-modal"
            onClick={async () => {
              if (!activeWallet) {
                console.error("No active wallet selected");
                return;
              }
              return new Promise<void>((resolve, reject) =>
                pushPage({
                  key: "Export Wallet With Passphrase",
                  content: (
                    <ExportWithPassphraseComponent
                      target={activeWallet.walletId}
                      exportType={ExportType.Wallet}
                      onSuccess={() => resolve()}
                      onError={(err) => reject(err)}
                    />
                  ),
                }),
              );
            }}
            style={{
              backgroundColor: "purple",
              borderRadius: "8px",
              padding: "8px 16px",
              color: "white",
            }}
          >
            Show Export Wallet Modal (With Passphrase)
          </button>

          <button
            onClick={() =>
              pushPage({
                key: "Decrypt With Passphrase",
                content: <DecryptWithPassphraseComponent />,
              })
            }
            style={{
              backgroundColor: "purple",
              borderRadius: "8px",
              padding: "8px 16px",
              color: "white",
            }}
          >
            Decrypt Passphrase Bundle
          </button>
          <button
            className="mt-4"
            onClick={() => logout()}
            style={{
              backgroundColor: "purple",
              borderRadius: "8px",
              padding: "8px 16px",
              color: "white",
            }}
          >
            Logout
          </button>
        </>
      )}
    </main>
  );
}
