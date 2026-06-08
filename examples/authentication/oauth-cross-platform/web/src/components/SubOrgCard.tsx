"use client";

import { type Wallet } from "@turnkey/react-wallet-kit";
import { WalletInfo } from "./WalletInfo";

type Props = {
  subOrgId: string;
  userId: string;
  wallets: Wallet[];
};

export function SubOrgCard({ subOrgId, userId, wallets }: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Sub-organization</h2>
      <Row label="Sub-org ID" value={subOrgId} />
      <Row label="User ID" value={userId} />
      {wallets.map((w) => (
        <WalletInfo key={w.walletId} wallet={w} />
      ))}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="font-mono text-xs text-gray-700 break-all">{value}</p>
    </div>
  );
}
