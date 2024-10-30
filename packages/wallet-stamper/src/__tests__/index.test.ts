import "dotenv/config";

import { WalletStamper } from "..";
import { TurnkeyClient } from "@turnkey/http";

import { MockEvmWallet, MockSolanaWallet } from "./wallet-interfaces";
import type { UUID } from "crypto";

// Import necessary Jest functions
import { describe, expect, it } from "@jest/globals";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ORGANIZATION_ID: UUID;
      BASE_URL: string;
    }
  }
}

const { ORGANIZATION_ID, BASE_URL } = process.env;

// Wrap the existing function in a Jest test block
describe("Wallet stamper tests", () => {
  it("Solana Wallet - Should list wallets using wallet to stamp the request", async () => {
    const mockWallet = new MockSolanaWallet();
    const walletStamper = new WalletStamper(mockWallet);

    const client = new TurnkeyClient({ baseUrl: BASE_URL }, walletStamper);

    const { wallets } =
      (await client.getWallets({
        organizationId: ORGANIZATION_ID,
      })) ?? {};

    expect(wallets?.length).toBeGreaterThan(0);
  });
  it("Ethereum Wallet - Should list wallets using wallet to stamp the request", async () => {
    const mockWallet = new MockEvmWallet();
    const walletStamper = new WalletStamper(mockWallet);

    const client = new TurnkeyClient({ baseUrl: BASE_URL }, walletStamper);

    const { wallets } =
      (await client.getWallets({
        organizationId: "704020e2-5b59-44a9-a78f-b74aecc67504",
      })) ?? {};

    expect(wallets?.length).toBeGreaterThan(0);
  });
});
