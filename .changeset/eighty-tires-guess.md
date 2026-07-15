---
"@turnkey/sdk-browser": major
"@turnkey/sdk-server": major
"@turnkey/http": major
---

- Synced with Mono v2026.7.3

- `EthSendTransaction()` function call now uses `ACTIVITY_TYPE_ETH_SEND_TRANSACTION_V2`. This activity allows for multiple eth calls to be batched together via the new `calls` array. This means the intent for the activity has now changed.

**Before:**

```ts
await client.ethSendTransaction({
  from,
  caip2,
  to,
  value,
  data,
});
```

**After:**

```ts
await client.ethSendTransaction({
  from,
  caip2,
  calls: [{ to, value, data }],
});
```
