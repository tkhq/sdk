// import 'dotenv/config';
// import { TurnkeyClient } from '@turnkey/http';
// import {
//   Address,
//   EIP1193Provider,
//   Index,
//   Quantity,
//   RpcTransactionRequest,
//   TransactionRequestEIP1559,
//   createWalletClient,
//   getAddress,
//   http,
//   numberToHex,
//   parseEther,
//   parseGwei,
//   recoverAddress,
//   serializeTransaction,
//   stringToHex,
// } from 'viem';
// import { sepolia } from 'viem/chains';

// import { createEIP1193Provider } from '../packages/eip-1193-provider/src';
// import { createAPIKeyStamper } from '../packages/eip-1193-provider/src/turnkey';
// import { preprocessTransaction } from '../packages/eip-1193-provider/src/utils';
// import { createAccount } from '@turnkey/viem';

// const ORG_ID = process.env.ORG_ID;
// const WALLET_ID = process.env.WALLET_ID;
// const TURNKEY_API_PUBLIC_KEY = process.env.TURNKEY_API_PUBLIC_KEY ?? '';
// const TURNKEY_API_PRIVATE_KEY = process.env.TURNKEY_API_PRIVATE_KEY ?? '';
// const EXPECTED_WALLET_ADDRESS: Address =
//   '0xb9d2e69E033b3cFBa1877b86041958778E1ae919';
// const RPC_URL = 'https://sepolia.infura.io/v3/c20bd1f24c384a0484d689caff11cacd';
// const RECEIVER_ADDRESS: Address = '0x6f85Eb534E14D605d4e82bF97ddF59c18F686699';
// const TEST_TIMEOUT = 10_000;

// declare module 'vitest' {
//   export interface TestContext {
//     eip1193Provider?: EIP1193Provider;
//   }
// }

// beforeEach(async (context) => {
//   const tk = new TurnkeyClient(
//     { baseUrl: 'https://api.turnkey.com' },
//     await createAPIKeyStamper({
//       apiPublicKey: TURNKEY_API_PUBLIC_KEY,
//       apiPrivateKey: TURNKEY_API_PRIVATE_KEY,
//     })
//   );
//   // extend context
//   context.eip1193Provider = createEIP1193Provider(
//     RPC_URL,
//     {
//       walletId: WALLET_ID,
//       organizationId: ORG_ID,
//     },
//     tk
//   );
// });

// describe('eth_accounts', () => {
//   it("should get accounts associated with the user's wallet", async ({
//     eip1193Provider,
//   }) => {
//     const accounts = await eip1193Provider?.request({ method: 'eth_accounts' });

//     assert.isArray(accounts);
//     assert.isNotEmpty(accounts, 'accounts should be non-empty');
//     expect(accounts).toContain(EXPECTED_WALLET_ADDRESS);
//   });
// });

// describe('eth_requestAccounts', () => {
//   it("should request accounts associated with the user's wallet", async ({
//     eip1193Provider,
//   }) => {
//     const accounts = await eip1193Provider?.request({
//       method: 'eth_requestAccounts',
//     });

//     assert.isArray(accounts);
//     assert.isNotEmpty(accounts, 'accounts should be non-empty');
//     expect(accounts).toContain(EXPECTED_WALLET_ADDRESS);
//   });
// });

// describe('eth_sign/person_sign', () => {
//   it(
//     'should sign a message',
//     async ({ eip1193Provider }) => {
//       const messageDigest = stringToHex('A man, a plan, a canal, Panama');
//       const signerAddress = EXPECTED_WALLET_ADDRESS;
//       const signature = await eip1193Provider?.request({
//         method: 'personal_sign',
//         params: [signerAddress, messageDigest],
//       });
//       assert.isNotEmpty(signature, '');
//       const address = await recoverAddress({
//         hash: messageDigest,
//         signature: signature!,
//       });
//       assert.equal(getAddress(address), getAddress(signerAddress));
//       assert.match(signature!, /^0x.*$/);
//     },
//     TEST_TIMEOUT
//   );
// });

// describe('eth_signTransaction', () => {
//   it('should sign a transaction', async ({ eip1193Provider }) => {
//     const from = EXPECTED_WALLET_ADDRESS;
//     const to = RECEIVER_ADDRESS;

//     const serializedTransaction = preprocessTransaction({
//       from,
//       to,
//       value: numberToHex(parseEther('0.001')),
//       chainId: numberToHex(sepolia.id),
//       nonce: numberToHex(0),
//       gas: numberToHex(21000n),
//       maxFeePerGas: numberToHex(parseGwei('20')),
//       maxPriorityFeePerGas: numberToHex(parseGwei('2')),
//       type: '0x2',
//     } as TransactionRequestEIP1559<Quantity, Index, '0x2'>);

//     const signature = await eip1193Provider?.request({
//       method: 'eth_signTransaction',
//       params: [
//         {
//           from,
//           to,
//           value: numberToHex(parseEther('0.001')),
//           chainId: numberToHex(sepolia.id),
//           nonce: numberToHex(0),
//           gas: numberToHex(21000n),
//           maxFeePerGas: numberToHex(parseGwei('20')),
//           maxPriorityFeePerGas: numberToHex(parseGwei('2')),
//           type: '0x2',
//         } as TransactionRequestEIP1559<Quantity, Index, '0x2'>,
//       ],
//     });

//     assert.isNotEmpty(signature, '');
//     assert.match(signature!, /^0x.*$/);
//   });
// });

// describe('eth_getBlockByNumber', () => {
//   it('should get blocknumber using the underlying RPC provider', async ({
//     eip1193Provider,
//   }) => {
//     const blockNumber = await eip1193Provider?.request({
//       method: 'eth_blockNumber',
//     });
//     console.log(blockNumber);
//     assert.isNotEmpty(blockNumber, '');
//     assert.match(blockNumber!, /^0x.*$/);
//   });
// });

// describe.only(
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
