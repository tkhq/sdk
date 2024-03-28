"use client"

import React, { useState, useEffect } from 'react';
import { WebauthnStamper } from '@turnkey/webauthn-stamper';
import { TurnkeyClient } from '@turnkey/http';
import { createEIP1193Provider } from '@turnkey/eip1193-provider';

export default function Home() {
  const [turnkeyClient, setTurnkeyClient] = useState<TurnkeyClient | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [provider, setProvider] = useState<any | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const initializeClient = async () => {
      const stamper = new WebauthnStamper({
        rpId: 'example.com',
      });

      const client = new TurnkeyClient(
        { baseUrl: 'https://api.turnkey.com' },
        stamper
      );

      setTurnkeyClient(client);
    };

    initializeClient();
  }, []);

  const handleLogin = async () => {
    if (turnkeyClient) {
      try {
        const { organizationId } = await turnkeyClient.getWhoami({
          organizationId: process.env.ORGANIZATION_ID,
        });

        setOrganizationId(organizationId);
        setIsLoggedIn(true);
      } catch (error) {
        console.error('Login failed:', error);
      }
    }
  };

  const handleConnectWallet = async () => {
    if (turnkeyClient && organizationId) {
      try {
        const { wallets } = await turnkeyClient.getWallets({
          organizationId,
        });

        setWallets(wallets);
        setWalletId(wallets[0].walletId);
      } catch (error) {
        console.error('Failed to get wallets:', error);
      }
    }
  };

  useEffect(() => {
    const initializeProvider = async () => {
      if (turnkeyClient && organizationId && walletId) {
        const chain = {
          chainName: 'Ethereum Mainnet',
          chainId: '0x1',
          rpcUrls: ['https://mainnet.infura.io/v3/your-infura-project-id'],
        };

        const provider = await createEIP1193Provider({
          walletId,
          organizationId,
          turnkeyClient,
          chains: [chain],
        });

        setProvider(provider);
      }
    };

    initializeProvider();
  }, [turnkeyClient, organizationId, walletId]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div>
        {!isLoggedIn ? (
          <button onClick={handleLogin}>Login</button>
        ) : (
          <button onClick={handleConnectWallet}>Connect Wallet</button>
        )}
        <button>Sign Up</button>
      </div>
    </main>
  );
}