---
"@turnkey/sdk-server": minor
"@turnkey/sdk-browser": minor
"@turnkey/core": minor
"@turnkey/sdk-types": minor
"@turnkey/http": minor
---

Sync transaction history API types with the latest public API swagger.

### Transaction history query endpoints

- `listEthTransactionHistory` (`POST /public/v1/query/list_eth_transaction_history`) — paginated EVM transaction history for a wallet or private-key address on a supported CAIP-2 chain.
- `listSolTransactionHistory` (`POST /public/v1/query/list_sol_transaction_history`) — paginated Solana transaction history for a wallet or private-key address on a supported CAIP-2 chain.

### Pagination type update

Transaction history pagination now uses the shared `v1Pagination` / `v1PageInfo` types instead of transaction-history-specific `v1TransactionHistoryPaginationOptions` / `v1TransactionHistoryPaginationCursors`.

**Before:**

```ts
const response = await client.listEthTransactionHistory({ ... });
const after = response.paginationCursors.after;
```

**After:**

```ts
const response = await client.listEthTransactionHistory({ ... });
const after = response.pageInfo?.endCursor;
```

These surfaces are generated into `@turnkey/http`, `@turnkey/sdk-types`, `@turnkey/sdk-browser`, `@turnkey/sdk-server`, and `@turnkey/core`.
