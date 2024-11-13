import { test, expect } from "@jest/globals";
import {
  SIGNATURE_SCHEME_TK_API_SECP256K1_EIP191,
  STAMP_HEADER_NAME,
  WalletStamper,
} from "../index";

import nacl from "tweetnacl";
import { decodeUTF8 } from "tweetnacl-util";

import { MockSolanaWallet } from "./wallet-interfaces";
import {
  EXPECTED_COMPRESSED_PUBLIC_KEY,
  EXPECTED_DER_SIGNATURE,
  SOLANA_PUBLIC_KEY_DECODED,
} from "./constants";
import { EthereumWallet } from "../ethereum";
import { setupEthereumMock } from "./utils";

setupEthereumMock();

test("Solana wallet stamping", async function () {
  const solanaWallet = new MockSolanaWallet();
  const stamper = new WalletStamper(solanaWallet);
  const messageToSign = "hello from TKHQ!";
  const stamp = await stamper.stamp(messageToSign);

  expect(stamp.stampHeaderName).toBe(STAMP_HEADER_NAME);

  const decodedStamp = JSON.parse(
    Buffer.from(stamp.stampHeaderValue, "base64url").toString()
  );

  expect(decodedStamp["publicKey"]).toBe(SOLANA_PUBLIC_KEY_DECODED);

  expect(decodedStamp["scheme"]).toBe("SIGNATURE_SCHEME_TK_API_ED25519");
  expect(
    nacl.sign.detached.verify(
      decodeUTF8(messageToSign),
      Buffer.from(decodedStamp["signature"], "hex"),
      solanaWallet.keypair.publicKey.toBytes()
    )
  ).toBe(true);
});

test("Ethereum wallet stamping", async function () {
  const ethereumWallet = new EthereumWallet();
  const stamper = new WalletStamper(ethereumWallet);
  const messageToSign = "MESSAGE";
  const stamp = await stamper.stamp(messageToSign);

  expect(stamp.stampHeaderName).toBe(STAMP_HEADER_NAME);

  const decodedStamp = JSON.parse(
    Buffer.from(stamp.stampHeaderValue, "base64url").toString()
  );

  expect(decodedStamp["publicKey"]).toBe(EXPECTED_COMPRESSED_PUBLIC_KEY);
  expect(decodedStamp["scheme"]).toBe(SIGNATURE_SCHEME_TK_API_SECP256K1_EIP191);
  expect(decodedStamp["signature"]).toBe(EXPECTED_DER_SIGNATURE);
});
