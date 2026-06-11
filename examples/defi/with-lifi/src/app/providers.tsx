"use client";

import {
  TurnkeyProvider,
  TurnkeyProviderConfig,
  CreateSubOrgParams,
} from "@turnkey/react-wallet-kit";
import { createConfig, http, WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ensure users created by the auth proxy are created with this wallet
const createSubOrgParams: CreateSubOrgParams = {
  customWallet: {
    walletName: "Bridge Wallet",
    walletAccounts: [
      // ETH address
      {
        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/60'/0'/0/0",
      },
      // SOL address
      {
        addressFormat: "ADDRESS_FORMAT_SOLANA",
        curve: "CURVE_ED25519",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/501'/0'/0/0",
      },
    ],
  },
};

const turnkeyConfig: TurnkeyProviderConfig = {
  organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  authProxyConfigId: process.env.NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID!,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.turnkey.com",
  authProxyUrl:
    process.env.NEXT_PUBLIC_AUTH_PROXY_BASE_URL ||
    "https://authproxy.turnkey.com",
  auth: {
    createSuborgParams: {
      passkeyAuth: createSubOrgParams,
      emailOtpAuth: createSubOrgParams,
    },
    autoRefreshSession: true,
  },
};

const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TurnkeyProvider
          config={turnkeyConfig}
          callbacks={{
            onError: (error) => console.error("Turnkey error:", error),
          }}
        >
          {children}
        </TurnkeyProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
