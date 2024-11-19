import { EthereumWallet, WalletStamper } from "..";
import { TurnkeyClient } from "@turnkey/http";

import { MockSolanaWallet } from "./wallet-interfaces";

// Import necessary Jest functions
import { describe, expect, it } from "@jest/globals";

import { setupEthereumMock } from "./utils";
import { BASE_URL, ORGANIZATION_ID } from "./constants";

setupEthereumMock();

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

  it("Ethereum Wallet - Should create a read only session using wallet to stamp the request", async () => {
    const ethereumWallet = new EthereumWallet();
    const stamper = new WalletStamper(ethereumWallet);
    const client = new TurnkeyClient({ baseUrl: BASE_URL }, stamper);

    const session = await client.createReadOnlySession({
      organizationId: ORGANIZATION_ID,
      type: "ACTIVITY_TYPE_CREATE_READ_ONLY_SESSION",
      timestampMs: Date.now().toString(),
      parameters: {},
    });

    expect(session).toBeDefined();
    expect(session.activity.status).toBe("ACTIVITY_STATUS_COMPLETED");
  });
});
