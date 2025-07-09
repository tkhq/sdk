"use client";

import React from "react";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { sepolia } from "viem/chains";

interface CoinbaseCryptoProviderProps {
  children: React.ReactNode;
}

const CoinbaseCryptoProvider = ({ children }: CoinbaseCryptoProviderProps) => {
  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY!}
      projectId={process.env.NEXT_PUBLIC_CDP_PROJECT_ID!}
      chain={sepolia}
    >
      {children}
    </OnchainKitProvider>
  );
};

export default CoinbaseCryptoProvider;
