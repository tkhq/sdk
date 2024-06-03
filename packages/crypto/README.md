# @turnkey/crypto

This package is runtime agnostic and consolidates some common cryptographic utilities used across our applications, particularly primitives related to keys, encryption, and decryption. For react-native you will need to polyfill our random byte generation by importing react-native-get-random-values: https://www.npmjs.com/package/react-native-get-random-values

```
import 'react-native-get-random-values'
```

Example usage (Hpke E2E):

```
const senderKeyPair = generateP256KeyPair();
const receiverKeyPair = generateP256KeyPair();

const receiverPublicKeyUncompressed = uncompressRawPublicKey(
  uint8ArrayFromHexString(receiverKeyPair.publicKey),
);

const plaintext = "Hello, this is a secure message!";
const encryptedData = hpkeEncrypt({
  plainText: plaintext,
  encappedKeyBuf: receiverPublicKeyUncompressed,
  senderPriv: senderKeyPair.privateKey,
});

// Extract the encapsulated key buffer and the ciphertext
const encappedKeyBuf = encryptedData.slice(0, 33);
const ciphertextBuf = encryptedData.slice(33);

const decryptedData = hpkeDecrypt({
  ciphertextBuf,
  encappedKeyBuf: uncompressRawPublicKey(encappedKeyBuf),
  receiverPriv: receiverKeyPair.privateKey,
});

// Convert decrypted data back to string
const decryptedText = new TextDecoder().decode(decryptedData);
```
