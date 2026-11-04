"use client";

import "@turnkey/react-wallet-kit/styles.css";
import { TurnkeyProvider } from "@turnkey/react-wallet-kit";

const config = {
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  auth: {
    autoRefreshSession: true,
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TurnkeyProvider config={config}>
      <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-2 text-center">
        <p className="text-sm text-yellow-800 font-medium">
          🚧 - This is a demo application
        </p>
      </div>
      {children}
    </TurnkeyProvider>
  );
}
