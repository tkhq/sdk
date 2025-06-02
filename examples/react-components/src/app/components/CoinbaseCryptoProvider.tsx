"use client";

import React from "react";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { baseSepolia } from "viem/chains";

interface CoinbaseCryptoProviderProps {
  children: React.ReactNode;
}

const CoinbaseCryptoProvider = ({ children }: CoinbaseCryptoProviderProps) => {
  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_COINBASE_API_KEY!}
      chain={baseSepolia}
    >
      {children}
    </OnchainKitProvider>
  );
};

export default CoinbaseCryptoProvider;
