import 'dotenv/config';

import {
  type Address,
  type Index,
  type Quantity,
  type TransactionRequestEIP1559,
  getAddress,
  numberToHex,
  parseEther,
  parseGwei,
  recoverAddress,
  stringToHex,
  verifyTypedData,
  ProviderRpcError,
  EIP1474Methods,
} from 'viem';

import { sepolia } from 'viem/chains';

import { beforeEach, describe, it, expect } from '@jest/globals';

import { createAPIKeyStamper, createEIP1193Provider } from '../';
import { TurnkeyClient } from '@turnkey/http';
import type { UUID } from 'crypto';
import type { TurnkeyEIP1193Provider } from '../types';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      WALLET_ID: UUID;
      ORG_ID: UUID;
      TURNKEY_API_PUBLIC_KEY: string;
      TURNKEY_API_PRIVATE_KEY: string;
    }
  }
}

// import { preprocessTransaction } from '../packages/eip-1193-provider/src/utils';
// import { createAccount } from '@turnkey/viem';

const ORG_ID = process.env.ORG_ID;
const WALLET_ID = process.env.WALLET_ID;
const TURNKEY_API_PUBLIC_KEY = process.env.TURNKEY_API_PUBLIC_KEY ?? '';
const TURNKEY_API_PRIVATE_KEY = process.env.TURNKEY_API_PRIVATE_KEY ?? '';
const EXPECTED_WALLET_ADDRESS: Address =
  '0xb9d2e69E033b3cFBa1877b86041958778E1ae919';
const RPC_URL = 'https://sepolia.infura.io/v3/c20bd1f24c384a0484d689caff11cacd';
const RECEIVER_ADDRESS: Address = '0x6f85Eb534E14D605d4e82bF97ddF59c18F686699';
const TEST_TIMEOUT = 10_000;

describe('Test Turnkey EIP-1193 Provider', () => {
  let eip1193Provider: TurnkeyEIP1193Provider;

  beforeEach(async () => {
    const tk = new TurnkeyClient(
      { baseUrl: 'https://api.turnkey.com' },
      await createAPIKeyStamper({
        apiPublicKey: TURNKEY_API_PUBLIC_KEY,
        apiPrivateKey: TURNKEY_API_PRIVATE_KEY,
      })
    );

    eip1193Provider = await createEIP1193Provider({
      rpcUrl: RPC_URL,
      walletId: WALLET_ID,
      organizationId: ORG_ID,
      turnkeyClient: tk,
      chainId: sepolia.id,
    });
  });

  describe('Supported Methods', () => {
    describe('EIP-1193 Wallet Methods', () => {
      describe('eth_accounts', () => {
        it("should get accounts associated with the user's wallet", async () => {
          const accounts = await eip1193Provider?.request({
            method: 'eth_accounts',
          });

          expect(accounts).not.toBeUndefined();
          expect(Array.isArray(accounts)).toBeTruthy();
          expect(accounts.length).toBeGreaterThan(0);
          expect(accounts).toContain(EXPECTED_WALLET_ADDRESS);
        });
      });

      describe('eth_requestAccounts', () => {
        it("should request accounts associated with the user's wallet", async () => {
          const accounts = await eip1193Provider.request({
            method: 'eth_requestAccounts',
          });
          expect(Array.isArray(accounts)).toBeTruthy();
          expect(accounts).toHaveLength(1);
          expect(accounts).toContain(EXPECTED_WALLET_ADDRESS);
        });
      });

      describe('eth_sign/person_sign', () => {
        it('should sign a message', async () => {
          const messageDigest = stringToHex('A man, a plan, a canal, Panama');
          const signerAddress = EXPECTED_WALLET_ADDRESS;
          const signature = await eip1193Provider?.request({
            method: 'personal_sign',
            params: [signerAddress, messageDigest],
          });
          expect(signature).not.toBeUndefined();
          expect(signature).not.toBe('');
          const address = await recoverAddress({
            hash: messageDigest,
            signature: signature!,
          });
          expect(getAddress(address)).toBe(getAddress(signerAddress));
          expect(signature).toMatch(/^0x.*$/);
        });
      });
      describe('eth_signTypedData_v4', () => {
        it('should sign typed data according to EIP-712', async () => {
          const address = EXPECTED_WALLET_ADDRESS;
          // Test typed data signing (EIP-712)
          // All properties on a domain are optional
          const domain = {
            name: 'Ether Mail',
            version: '1',
            chainId: 1,
            verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
          } as const;

          // The named list of all type definitions
          const types = {
            Person: [
              { name: 'name', type: 'string' },
              { name: 'wallet', type: 'address' },
            ],
            Mail: [
              { name: 'from', type: 'Person' },
              { name: 'to', type: 'Person' },
              { name: 'contents', type: 'string' },
            ],
          } as const;
          const primaryType = 'Mail';
          const message = {
            from: {
              name: 'Cow',
              wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
            },
            to: {
              name: 'Bob',
              wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
            },
            contents: 'Hello, Bob!',
          } as const;
          const typedData = {
            address,
            domain,
            types,
            primaryType,
            message,
          } as const;

          const signature = await eip1193Provider?.request({
            method: 'eth_signTypedData_v4',
            params: [EXPECTED_WALLET_ADDRESS, typedData],
          });

          const valid = await verifyTypedData({
            address: EXPECTED_WALLET_ADDRESS,
            domain,
            types,
            primaryType,
            message,
            signature,
          });

          expect(valid).toBeTruthy();
          expect(signature).not.toBeNull();
          expect(signature).not.toBe('');
          expect(signature).toMatch(/^0x[a-fA-F0-9]+$/);
        });
      });
      describe('eth_signTransaction', () => {
        it('should sign a transaction', async () => {
          const from = EXPECTED_WALLET_ADDRESS;
          const to = RECEIVER_ADDRESS;

          //   const serializedTransaction = preprocessTransaction({
          //     from,
          //     to,
          //     value: numberToHex(parseEther('0.001')),
          //     chainId: numberToHex(sepolia.id),
          //     nonce: numberToHex(0),
          //     gas: numberToHex(21000n),
          //     maxFeePerGas: numberToHex(parseGwei('20')),
          //     maxPriorityFeePerGas: numberToHex(parseGwei('2')),
          //     type: '0x2',
          //   } as TransactionRequestEIP1559<Quantity, Index, '0x2'>);

          const signature = await eip1193Provider?.request({
            method: 'eth_signTransaction',
            params: [
              {
                from,
                to,
                value: numberToHex(parseEther('0.001')),
                chainId: numberToHex(sepolia.id),
                nonce: numberToHex(0),
                gas: numberToHex(21000n),
                maxFeePerGas: numberToHex(parseGwei('20')),
                maxPriorityFeePerGas: numberToHex(parseGwei('2')),
                type: '0x2',
              } as TransactionRequestEIP1559<Quantity, Index, '0x2'>,
            ],
          });
          console.log(signature);
          expect(signature).toBeDefined();
          expect(signature).not.toBe('');
          expect(signature).toMatch(/^0x[a-fA-F0-9]+$/);
        });
      });

      describe('eth_getBlockByNumber', () => {
        it('should get blocknumber using the underlying RPC provider', async () => {
          const blockNumber = await eip1193Provider?.request({
            method: 'eth_blockNumber',
          });
          expect(blockNumber).not.toBeUndefined();
          expect(blockNumber).not.toBe('');
          expect(blockNumber).toMatch(/^0x.*$/);
        });
      });

      describe('web3_clientVersion', () => {
        it('should return the version of the client matching package.json version', async () => {
          const version = await eip1193Provider?.request({
            method: 'web3_clientVersion',
          });
          const packageJson = require('../../package.json');
          const expectedVersion = `TurnkeyEIP1193Provider/v${packageJson.version}`;
          expect(version).toBeDefined();
          expect(version).toBe(expectedVersion);
        });
      });
    });

    describe('Public RPC Methods', () => {
      describe('eth_chainId', () => {
        it('should get the correct chain id using the underlying RPC provider', async () => {
          const chainId = await eip1193Provider?.request({
            method: 'eth_chainId',
          });
          expect(chainId).not.toBeUndefined();
          expect(chainId).toMatch(/^0x.*$/);
          expect(parseInt(chainId!, 16)).toBe(sepolia.id);
        });
      });
    });
  });

  describe('Unsupported Methods', () => {
    describe('Unsupported Methods', () => {
      const unsupportedMethods = [
        'wallet_getPermissions',
        'wallet_requestPermissions',
        'wallet_revokePermissions',
        'wallet_registerOnboarding',
        'wallet_watchAsset',
        'wallet_scanQRCode',
        'wallet_getSnaps',
        'wallet_requestSnaps',
        'wallet_snap',
        'wallet_invokeSnap',
        'eth_decrypt',
        'eth_getEncryptionPublicKey',
      ];

      unsupportedMethods.forEach((method) => {
        it(`should throw a Method not supported error for ${method}`, async () => {
          await expect(
            eip1193Provider?.request({
              method: method as EIP1474Methods[0]['Method'],
            })
          ).rejects.toEqual(
            expect.objectContaining({
              code: 4200,
              message: expect.stringContaining('Method not supported'),
            })
          );
        });
      });
    });
  });
});

// describe(
//   'eth_chainId',
//   () => {
//     it('should get the correct chain id using the underlying RPC provider', async ({
//       eip1193Provider,
//     }) => {
//       const chainId = await eip1193Provider?.request({
//         method: 'eth_chainId',
//       });
//       console.log(sepolia.id);
//       assert.isNotEmpty(chainId, '');
//       assert.match(chainId!, /^0x.*$/);
//       assert.equal(parseInt(chainId!, 16), sepolia.id);
//     });
//   },
//   TEST_TIMEOUT
// );
