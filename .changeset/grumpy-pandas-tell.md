---
"@turnkey/sdk-types": minor
---

- Synced with Mono v2026.7.3

- Added version-specific types for `ACTIVITY_TYPE_ETH_SEND_TRANSACTION_V2`, which supports batching multiple eth calls together via the new `calls` array.

  ```ts
  // V1 (unchanged) — single call, top-level fields
  type v1EthSendTransactionIntent = {
    from: string;
    caip2: string;
    to: string;
    value?: string;
    data?: string;
    // ...
  };

  // V2 (new) — one or more calls in a `calls` array
  type v1EthSendTransactionIntentV2 = {
    from: string;
    caip2: string;
    calls: v1EthCallParams[]; // [{ to, value?, data? }]
    // ...
  };
  ```
