---
"@turnkey/react-wallet-kit": minor
---

- Synced with Mono v2026.7.3

- Added `EthSendTransactionV2()` `httpClient` function which uses `ACTIVITY_TYPE_ETH_SEND_TRANSACTION_V2`. This activity allows for multiple eth calls to be batched together via the new `calls` array. The existing `EthSendTransaction()` `httpClient` remains on the previous activity version.

- `ethSendTransaction` helper function can now accept a `calls` array in the `transaction` parameter which will direct the call to use `ACTIVITY_TYPE_ETH_SEND_TRANSACTION_V2`. Passing the legacy `to`/`value`/`data` fields still works and continues to use V1.

  ```ts
  // V1 (still works, unchanged)
  await client.ethSendTransaction({
    transaction: { from, caip2, to, value, data },
  });

  // V2 — batch one or more calls via `calls`
  await client.ethSendTransaction({
    transaction: {
      from,
      caip2,
      calls: [{ to, value, data }],
    },
  });
  ```

- `handleSendTransaction` helper function can now accept a `calls` array in the `transaction` parameter which will direct the call to use `ACTIVITY_TYPE_ETH_SEND_TRANSACTION_V2`. Passing the legacy `to`/`value`/`data` fields still works and continues to use V1.

  ```ts
  // V1 (still works, unchanged)
  await handleSendTransaction({
    transaction: { from, caip2, to, value, data },
  });

  // V2 — batch one or more calls via `calls`
  await handleSendTransaction({
    transaction: {
      from,
      caip2,
      calls: [{ to, value, data }],
    },
  });
  ```
