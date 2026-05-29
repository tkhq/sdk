"use client";

import { type Wallet, type WalletAccount } from "@turnkey/react-wallet-kit";

type Props = {
  wallet: Wallet;
};

export function WalletInfo({ wallet }: Props) {
  const accounts = (wallet.accounts ?? []) as WalletAccount[];

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
      <h3 className="text-xs font-semibold text-gray-900">
        {wallet.walletName || "Wallet"}
      </h3>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">Wallet ID</p>
        <p className="font-mono text-xs text-gray-700 break-all">
          {wallet.walletId}
        </p>
      </div>
      {accounts.map((a) => (
        <div key={a.address}>
          <p className="text-xs text-gray-400 mb-0.5">
            {toAssetLabel(a.addressFormat)}
          </p>
          <p className="font-mono text-xs text-gray-700 break-all">
            {a.address}
          </p>
        </div>
      ))}
    </div>
  );
}

function toAssetLabel(addressFormat: string): string {
  if (addressFormat === "ADDRESS_FORMAT_ETHEREUM") return "Ethereum";
  if (addressFormat === "ADDRESS_FORMAT_SOLANA") return "Solana";
  return addressFormat;
}
