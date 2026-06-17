"use client";

import { useTurnkey } from "@turnkey/react-wallet-kit";
import { type ReactElement } from "react";
import InfoRow from "./InfoRow";

export default function WalletInfo(): ReactElement {
  const { wallets, user, session, createWallet, fetchWallets } = useTurnkey();

  const stellarAccounts = wallets.flatMap((w) =>
    w.accounts
      .filter((a) => a.addressFormat === "ADDRESS_FORMAT_XLM")
      .map((a) => ({ ...a, walletId: w.walletId, walletName: w.walletName })),
  );

  async function handleCreateWallet() {
    await createWallet({
      walletName: `Stellar Wallet ${wallets.length + 1}`,
      accounts: ["ADDRESS_FORMAT_XLM"],
    });
    await fetchWallets();
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Wallet Info</h2>
        <button
          onClick={handleCreateWallet}
          className="text-xs px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer transition-colors"
        >
          + New Wallet
        </button>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <InfoRow label="User ID" value={user?.userId ?? ""} />
        <InfoRow label="Sub-Org ID" value={session?.organizationId ?? ""} />
      </div>

      {wallets.length === 0 ? (
        <p className="text-sm text-gray-400">No wallets found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {wallets.map((wallet) => (
            <div
              key={wallet.walletId}
              className="rounded-lg bg-gray-50 border border-gray-100 p-3 flex flex-col gap-2 text-sm"
            >
              <InfoRow label="Wallet Name" value={wallet.walletName} />
              <InfoRow label="Wallet ID" value={wallet.walletId} mono />
              {wallet.accounts
                .filter((a) => a.addressFormat === "ADDRESS_FORMAT_XLM")
                .map((account) => (
                  <InfoRow
                    key={account.walletAccountId}
                    label="Stellar Address"
                    value={account.address}
                    mono
                    link={`https://stellar.expert/explorer/testnet/account/${account.address}`}
                  />
                ))}
            </div>
          ))}
        </div>
      )}

      {stellarAccounts.length === 0 && wallets.length > 0 && (
        <p className="text-sm text-amber-600">
          No Stellar accounts found in your wallets.
        </p>
      )}
    </section>
  );
}
