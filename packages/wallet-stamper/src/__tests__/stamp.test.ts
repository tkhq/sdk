import { test, expect } from '@jest/globals';
import { STAMP_HEADER_NAME, WalletStamper } from '../index';

import nacl from 'tweetnacl';
import { decodeUTF8 } from 'tweetnacl-util';

import { verifyMessage } from 'viem';
import { MockSolanaWallet, MockEvmWallet } from './wallet-interfaces';
import { ETHEREUM_PUBLIC_KEY, SOLANA_PUBLIC_KEY_DECODED } from './constants';

test.skip('Solana wallet stamping', async function () {
  const solanaWallet = new MockSolanaWallet();
  const stamper = new WalletStamper(solanaWallet);
  const messageToSign = 'hello from TKHQ!';
  const stamp = await stamper.stamp(messageToSign);

  expect(stamp.stampHeaderName).toBe(STAMP_HEADER_NAME);

  const decodedStamp = JSON.parse(
    Buffer.from(stamp.stampHeaderValue, 'base64url').toString()
  );

  expect(decodedStamp['publicKey']).toBe(SOLANA_PUBLIC_KEY_DECODED);

  expect(decodedStamp['scheme']).toBe('SIGNATURE_SCHEME_TK_API_ED25519');
  expect(
    nacl.sign.detached.verify(
      decodeUTF8(messageToSign),
      Buffer.from(decodedStamp['signature'], 'base64'),
      solanaWallet.keypair.publicKey.toBytes()
    )
  ).toBe(true);
});

test.skip('EVM wallet stamping', async function () {
  const evmWallet = new MockEvmWallet();
  const stamper = new WalletStamper(evmWallet);
  const messageToSign = 'hello from TKHQ!';
  const stamp = await stamper.stamp(messageToSign);

  expect(stamp.stampHeaderName).toBe(STAMP_HEADER_NAME);

  const decodedStamp = JSON.parse(
    Buffer.from(stamp.stampHeaderValue, 'base64url').toString()
  );

  expect(decodedStamp['publicKey']).toBe(ETHEREUM_PUBLIC_KEY);
  expect(decodedStamp['scheme']).toBe('SIGNATURE_SCHEME_TK_API_P256');
  const valid = await verifyMessage({
    address: evmWallet.account.address,
    message: messageToSign,
    signature: decodedStamp['signature'],
  });
  expect(valid).toBe(true);
});
