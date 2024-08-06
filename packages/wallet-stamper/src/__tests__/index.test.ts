import 'dotenv/config';

import { WalletStamper } from '..';
import { TurnkeyClient } from '@turnkey/http';

import { MockSolanaWallet } from './wallet-interfaces';
import type { UUID } from 'crypto';

// Import necessary Jest functions
import { describe, expect, it } from '@jest/globals';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ORGANIZATION_ID: UUID;
      BASE_URL: string;
      USER_ID: UUID;
    }
  }
}

const { ORGANIZATION_ID, BASE_URL, USER_ID } = process.env;

// Wrap the existing function in a Jest test block
describe('Wallet stamper tests', () => {
  it.only('Should list wallets using wallet to stamp the request', async () => {
    const mockWallet = new MockSolanaWallet();
    const walletStamper = new WalletStamper(mockWallet);

    const client = new TurnkeyClient({ baseUrl: BASE_URL }, walletStamper);

    const { user } =
      (await client.getUser({
        organizationId: ORGANIZATION_ID,
        userId: USER_ID,
      })) ?? {};

    expect(user?.userId).toBe(USER_ID);
  });
});