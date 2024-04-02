"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  TurnkeyEIP1193Provider,
  createEIP1193Provider,
} from "@turnkey/eip-1193-provider";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { TurnkeyClient } from "@turnkey/http";
import { numberToHex } from "viem";
import { sepolia } from "viem/chains";

type TurnkeyProviderContextType = {
  turnkeyProvider: TurnkeyEIP1193Provider | null;
  setTurnkeyProvider: React.Dispatch<
    React.SetStateAction<TurnkeyEIP1193Provider | null>
  >;
};

const TurnkeyProviderContext = createContext<
  TurnkeyProviderContextType | undefined
>(undefined);

export const TurnkeyProviderProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [turnkeyProvider, setTurnkeyProvider] =
    useState<TurnkeyEIP1193Provider | null>(null);

  useEffect(() => {
    const initializeProvider = async () => {
      const storedData = localStorage.getItem("turnkeyProviderData");
      if (storedData) {
        const { walletId, organizationId } = JSON.parse(storedData);
        const stamper = new WebauthnStamper({
          rpId: process.env.NEXT_PUBLIC_WEBAUTHN_RPID!,
        });
        const client = new TurnkeyClient(
          { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
          stamper
        );
        const chain = {
          chainName: sepolia.name,
          chainId: numberToHex(sepolia.id),
          rpcUrls: [process.env.NEXT_PUBLIC_RPC_URL!],
        };
        const provider = await createEIP1193Provider({
          walletId,
          organizationId,
          turnkeyClient: client,
          chains: [chain],
        });
        setTurnkeyProvider(provider);
      }
    };

    initializeProvider();
  }, []);

  return (
    <TurnkeyProviderContext.Provider
      value={{ turnkeyProvider, setTurnkeyProvider }}
    >
      {children}
    </TurnkeyProviderContext.Provider>
  );
};

export const useTurnkeyProvider = () => {
  const context = useContext(TurnkeyProviderContext);
  if (!context) {
    throw new Error(
      "useTurnkeyProvider must be used within a TurnkeyProviderProvider"
    );
  }
  return context;
};
