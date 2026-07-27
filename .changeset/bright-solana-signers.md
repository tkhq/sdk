---
"@turnkey/http": major
"@turnkey/sdk-browser": major
"@turnkey/sdk-server": major
---

Add Solana send-transaction v2 support for transactions requiring multiple Turnkey signers.

`solSendTransaction()` now uses `ACTIVITY_TYPE_SOL_SEND_TRANSACTION_V2`. The v2 intent accepts an ordered `signWiths` array for transactions requiring multiple Turnkey signers, and its full unsigned transaction wire format is hex-encoded.

**Before:**

```ts
await client.solSendTransaction({
  unsignedTransaction: unsignedTransactionBase64,
  signWith: signerAddress,
  caip2,
  sponsor,
});
```

**After:**

```ts
await client.solSendTransaction({
  unsignedTransaction: unsignedTransactionHex,
  signWiths: [signerAddress],
  caip2,
  sponsor,
});
```
