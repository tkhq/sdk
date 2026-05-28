# @turnkey/crypto

This package consolidates some common cryptographic utilities used across our applications, particularly primitives related to keys, encryption, and decryption in a pure JS implementation. For react-native you will need to polyfill our random byte generation by importing [react-native-get-random-values](https://www.npmjs.com/package/react-native-get-random-values)

Example usage (Hpke E2E):

```
const senderKeyPair = generateP256KeyPair();
const receiverKeyPair = generateP256KeyPair();

const receiverPublicKeyUncompressed = uncompressRawPublicKey(
  uint8ArrayFromHexString(receiverKeyPair.publicKey),
);

const plainText = "Hello, this is a secure message!";
const plainTextBuf = textEncoder.encode(plainText);
const encryptedData = hpkeEncrypt({
  plainTextBuf: plainTextBuf,
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

## Verifying Turnkey webhooks

Use `@turnkey/crypto` directly when you want to manage verification-key fetching and caching yourself. Verification must use the exact raw request body bytes that Turnkey sent, the Turnkey signature headers, Turnkey webhook verification keys, and an explicit `maxTimestampAgeMs` replay window.

Turnkey sends these signature headers with the body: `x-turnkey-timestamp`, `x-turnkey-event-id`, `x-turnkey-signature-key-id`, `x-turnkey-signature-algorithm`, `x-turnkey-signature-version`, and `x-turnkey-signature`. Pass the complete headers object through as received.

`x-turnkey-event-id` is stable across retry attempts for the same webhook event. Use it as the deduplication or idempotency key after signature verification succeeds.

```ts
import { verifyTurnkeyWebhookSignature } from "@turnkey/crypto";

const body = req.body; // Buffer from express.raw(), not parsed JSON
const verificationKeys = [
  {
    keyId: process.env.TURNKEY_WEBHOOK_KEY_ID!,
    publicKey: process.env.TURNKEY_WEBHOOK_PUBLIC_KEY!, // Hex-encoded Ed25519 public key
    algorithm: "ed25519",
  },
];

const result = verifyTurnkeyWebhookSignature({
  headers: req.headers,
  body,
  verificationKeys,
  maxTimestampAgeMs: 5 * 60 * 1000,
});

if (!result.ok) {
  throw new Error(`Invalid Turnkey webhook: ${result.reason}`);
}

const event = JSON.parse(body.toString("utf8"));
```

Do not verify a parsed and re-stringified JSON object. Even harmless-looking changes to whitespace or key ordering will change the signed payload.
