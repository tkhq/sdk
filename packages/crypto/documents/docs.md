---
title: "Crypto"
description: "The [`@turnkey/crypto`](https://www.npmjs.com/package/@turnkey/crypto) package exposes low-level cryptographic helpers used across Turnkey SDKs."
---

## Webhook Verification

Use `@turnkey/crypto` directly when you want to fetch and cache Turnkey's webhook verification keys yourself. Verification requires the exact raw body bytes, Turnkey signature headers, verification keys, and a required `maxTimestampAgeMs` replay window.

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

Do not verify a parsed and re-stringified JSON object. The signed payload is the raw bytes Turnkey sent.
