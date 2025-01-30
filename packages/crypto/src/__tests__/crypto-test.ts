import { test, expect, describe } from "@jest/globals";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { TurnkeyClient } from "@turnkey/http";
import { uint8ArrayFromHexString } from "@turnkey/encoding";
import {
  getPublicKey,
  generateP256KeyPair,
  decryptCredentialBundle,
  extractPrivateKeyFromPKCS8Bytes,
  uncompressRawPublicKey,
  compressRawPublicKey,
  hpkeDecrypt,
  hpkeEncrypt,
  hpkeAuthEncrypt,
  formatHpkeBuf,
  verifyStampSignature,
} from "../";

// Mock data for testing
const mockSenderPrivateKey =
  "67ee05fc3bdf4161bc70701c221d8d77180294cefcfcea64ba83c4d4c732fcb9";
const mockPrivateKey =
  "20fa65df11f24833790ae283fc9a0c215eecbbc589549767977994dc69d05a56";
const mockCredentialBundle =
  "w99a5xV6A75TfoAUkZn869fVyDYvgVsKrawMALZXmrauZd8hEv66EkPU1Z42CUaHESQjcA5bqd8dynTGBMLWB9ewtXWPEVbZvocB4Tw2K1vQVp7uwjf";

describe("HPKE Encryption and Decryption", () => {
  test("hpkeAuthEncrypt and hpkeDecrypt - end-to-end encryption and decryption", () => {
    const senderKeyPair = generateP256KeyPair();
    const receiverKeyPair = generateP256KeyPair();
    const receiverPublicKeyUncompressed = uncompressRawPublicKey(
      uint8ArrayFromHexString(receiverKeyPair.publicKey)
    );

    const textEncoder = new TextEncoder();
    // Mock plaintext
    const plainText = "Hello, this is a secure message!";
    const plainTextBuf = textEncoder.encode(plainText);
    // Encrypt
    const encryptedDataBuf = hpkeAuthEncrypt({
      plainTextBuf: plainTextBuf,
      targetKeyBuf: receiverPublicKeyUncompressed,
      senderPriv: senderKeyPair.privateKey,
    });
    const encryptedData = formatHpkeBuf(encryptedDataBuf);
    // Extract the encapsulated key buffer and the ciphertext
    const data = JSON.parse(encryptedData);
    // Decrypt
    const decryptedData = hpkeDecrypt({
      ciphertextBuf: uint8ArrayFromHexString(data.ciphertext),
      encappedKeyBuf: uint8ArrayFromHexString(data.encappedPublic),
      receiverPriv: receiverKeyPair.privateKey,
    });

    // Convert decrypted data back to string
    const decryptedText = new TextDecoder().decode(decryptedData);

    // Expect the decrypted text to equal the original plaintext
    expect(decryptedText).toEqual(plainText);
  });
});

describe("HPKE Standard Encryption and Decryption", () => {
  test("hpkeEncrypt and hpkeDecrypt - standard mode (ephemeral sender key)", async () => {
    // Generate a receiver key pair
    const receiverKeyPair = generateP256KeyPair();
    const receiverPublicKeyUncompressed = uncompressRawPublicKey(
      uint8ArrayFromHexString(receiverKeyPair.publicKey)
    );

    // Prepare the plaintext
    const textEncoder = new TextEncoder();
    const plainText =
      "6ab33bd6e4bdc73017233da0554f9616fe10ede5c3ce001e81b321d5a74199b7";
    const plainTextBuf = textEncoder.encode(plainText);

    // Encrypt using standard mode (no sender private key provided)
    const encryptedDataBuf = hpkeEncrypt({
      plainTextBuf: plainTextBuf,
      targetKeyBuf: receiverPublicKeyUncompressed,
      // No senderPriv provided, so it will use an ephemeral key
    });
    const encryptedData = formatHpkeBuf(encryptedDataBuf);
    // Parse the encrypted data
    const data = JSON.parse(encryptedData);
    // Decrypt the message
    const decryptedData = hpkeDecrypt({
      ciphertextBuf: uint8ArrayFromHexString(data.ciphertext),
      encappedKeyBuf: uint8ArrayFromHexString(data.encappedPublic),
      receiverPriv: receiverKeyPair.privateKey,
    });

    // Convert decrypted data back to string
    const decryptedText = new TextDecoder().decode(decryptedData);

    // Verify that the decrypted text matches the original plaintext
    expect(decryptedText).toEqual(plainText);

    // Additional checks to ensure standard mode behavior
    const encappedPublicKey = uint8ArrayFromHexString(data.encappedPublic);
    expect(encappedPublicKey.length).toBe(65); // Uncompressed public key length
    expect(encappedPublicKey[0]).toBe(0x04); // Uncompressed public key prefix
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

  test("decryptCredentialBundle - successfully decrypts a credential bundle", () => {
    const decryptedData = decryptCredentialBundle(
      mockCredentialBundle,
      mockPrivateKey
    );
    expect(decryptedData).toBe(mockSenderPrivateKey);
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

  test("verifyRequestStamp", async () => {
    const { publicKey, privateKey } = generateP256KeyPair();
    const serverClient = new TurnkeyServerSDK({
      apiBaseUrl: "https://api.turnkey.com",
      apiPrivateKey: privateKey,
      apiPublicKey: publicKey,
      defaultOrganizationId: "00000000-00000000-00000000-00000000",
    });
    const stamper = serverClient.apiClient().config.stamper!;
    const turnkeyClient = new TurnkeyClient(
      {
        baseUrl: "https://api.turnkey.com",
      },
      stamper
    );

    const stampedRequest = await turnkeyClient.stampGetWhoami({
      organizationId: "00000000-00000000-00000000-00000000",
    });

    const stampContents = stampedRequest.stamp.stampHeaderValue;
    const decodedStampContents = atob(stampContents);
    const parsedStampContents = JSON.parse(decodedStampContents);
    const signature = parsedStampContents.signature;

    const verified = await verifyStampSignature(
      publicKey,
      signature,
      stampedRequest.body
    );

    expect(verified).toEqual(true);
  });
});
