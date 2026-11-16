---
"@turnkey/http": minor
"@turnkey/sdk-types": minor
"@turnkey/sdk-server": minor
"@turnkey/sdk-browser": minor
"@turnkey/core": minor
"@turnkey/react-wallet-kit": minor
"@turnkey/react-native-wallet-kit": minor
---

Sync generated clients and types with mono `main` (2026-11-16).

- Earn: `listEarnVaults` and `listEarnEnabledVaults` entries carry `rewardsApyPct`, the protocol-reward portion of `apyPct`. `apyPct` is now documented as gross APY including rewards and `netApyPct` as net of fees on the non-reward portion only.
- Send-transaction status responses carry the landed transaction's `fee` (`EthTransactionFee` on EVM, `SolanaTransactionFee` on Solana) with the sponsored cost in USD.
- Swap quotes include `transactions`, the calls the swap executes in order.
- Usage controls: `UsageControlAggregation` is replaced by `UsageControlBudget` (`method`, `limit`, `window`), and the data source filters are removed.
- `deleteExternalSigner` accepts `deleteWithoutExport`; `TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V2` is added.

The `with-earn` example now runs on Solana as well as EVM: set `CHAIN_CAIP2` to `solana:mainnet` or `solana:devnet` to enable a Kamino vault, deposit, withdraw, and claim fees with the same scripts.
