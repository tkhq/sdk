import { test, expect, describe } from "@jest/globals";
import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";
import {
  getPublicKey,
  generateP256KeyPair,
  decryptBundle,
  extractPrivateKeyFromPKCS8Bytes,
  uncompressRawPublicKey,
  compressRawPublicKey,
  hpkeDecrypt,
  hpkeEncrypt,
} from "../crypto";

// Mock data for testing
const mockSenderPrivateKey =
  "67ee05fc3bdf4161bc70701c221d8d77180294cefcfcea64ba83c4d4c732fcb9";
const mockPrivateKey =
  "20fa65df11f24833790ae283fc9a0c215eecbbc589549767977994dc69d05a56";
const mockCredentialBundle =
  "w99a5xV6A75TfoAUkZn869fVyDYvgVsKrawMALZXmrauZd8hEv66EkPU1Z42CUaHESQjcA5bqd8dynTGBMLWB9ewtXWPEVbZvocB4Tw2K1vQVp7uwjf";

describe("HPKE Encryption and Decryption", () => {
  test("hpkeEncrypt and hpkeDecrypt - end-to-end encryption and decryption", () => {
    const senderKeyPair = generateP256KeyPair();
    const receiverKeyPair = generateP256KeyPair();
    const receiverPublicKeyUncompressed = uncompressRawPublicKey(
      uint8ArrayFromHexString(receiverKeyPair.publicKey)
    );

    // Mock plaintext
    const plaintext = "Hello, this is a secure message!";

    // Encrypt
    const encryptedData = hpkeEncrypt({
      plainText: plaintext,
      encappedKeyBuf: receiverPublicKeyUncompressed,
      senderPriv: senderKeyPair.privateKey,
    });

    // Extract the encapsulated key buffer and the ciphertext
    const encappedKeyBuf = encryptedData.slice(0, 33);
    const ciphertextBuf = encryptedData.slice(33);

    // Decrypt
    const decryptedData = hpkeDecrypt({
      ciphertextBuf,
      encappedKeyBuf: uncompressRawPublicKey(encappedKeyBuf),
      receiverPriv: receiverKeyPair.privateKey,
    });

    // Convert decrypted data back to string
    const decryptedText = new TextDecoder().decode(decryptedData);

    // Expect the decrypted text to equal the original plaintext
    expect(decryptedText).toEqual(plaintext);
  });
});

describe("Turnkey Crypto Primitives", () => {
  test("getPublicKey - returns the correct public key", () => {
    const keyPair = generateP256KeyPair();
    const publicKey = getPublicKey(
      uint8ArrayFromHexString(keyPair.privateKey),
      true
    );
    expect(publicKey).toHaveLength(33);
  });

  test("generateP256KeyPair - generates a valid key pair", () => {
    const keyPair = generateP256KeyPair();
    expect(keyPair.privateKey).toBeTruthy();
    expect(keyPair.publicKey).toBeTruthy();
    expect(keyPair.publicKeyUncompressed).toBeTruthy();
    expect(keyPair.privateKey).not.toEqual(keyPair.publicKey);
    expect(keyPair.publicKey).not.toEqual(keyPair.publicKeyUncompressed);
  });

  test("compressRawPublicKey - returns a valid value", () => {
    const { publicKey, publicKeyUncompressed } = generateP256KeyPair();
    expect(
      compressRawPublicKey(uint8ArrayFromHexString(publicKeyUncompressed))
    ).toEqual(uint8ArrayFromHexString(publicKey));
  });

  test("decryptBundle - successfully decrypts a credential bundle", () => {
    const decryptedData = decryptBundle(mockCredentialBundle, mockPrivateKey);
    expect(decryptedData).toBeInstanceOf(Uint8Array);
    expect(uint8ArrayToHexString(decryptedData)).toBe(mockSenderPrivateKey);
  });

  test("extractPrivateKeyFromPKCS8Bytes", () => {
    const pkcs8PrivateKeyHex =
      "308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b020101042001d95d256f744b2a855fe2036ec1074c726445f1382f53580a17ce3296cc2deca1440342000440fa0a112351e0f5cdcc3edad914e7e3b911d3e83874d4ef55ff5639f4a3633e65087a8499c46a77f8e68c937203d85e6d38ade95d755a6cf88fa101091d5983";
    const expectedRawPrivateKeyHex =
      "01d95d256f744b2a855fe2036ec1074c726445f1382f53580a17ce3296cc2dec";
    expect(
      extractPrivateKeyFromPKCS8Bytes(
        uint8ArrayFromHexString(pkcs8PrivateKeyHex)
      )
    ).toEqual(uint8ArrayFromHexString(expectedRawPrivateKeyHex));
  });
});
