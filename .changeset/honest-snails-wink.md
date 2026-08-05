---
"@turnkey/sdk-browser": minor
"@turnkey/sdk-server": minor
"@turnkey/sdk-types": minor
"@turnkey/core": minor
"@turnkey/http": minor
---

Sync generated API clients and types with the latest public API swagger.

### New query endpoints

- `getClaimEarnFeesStatus` (`POST /public/v1/query/get_claim_earn_fees_status`) — poll Earn fee-claim status by the `claimRequestId` returned from `ClaimEarnFees`. Response status is `PENDING` | `COMPLETED` | `FAILED`, with optional `claimTxHash` / `error`.
- `getSwapStatus` (`POST /public/v1/query/get_swap_status`) — poll swap status by the `swapRequestId` returned from `ExecuteSwap`. Covers same-chain and cross-chain swaps, and returns provider, input/output tokens and amounts, origin/destination tx hashes, optional refund info on failure, and normalized error details.

### New submit endpoints / activities

- `claimSwapFees` (`POST /public/v1/submit/claim_swap_fees`, `ACTIVITY_TYPE_CLAIM_SWAP_FEES`) — claim swap fees through the activity pipeline; result includes a Relay `requestId`.
- `ethUndelegate7702` (`POST /public/v1/submit/eth_undelegate_7702`, `ACTIVITY_TYPE_ETH_UNDELEGATE_7702`) — submit an EIP-7702 undelegation for a wallet/private-key address on a supported CAIP-2 chain. Optional nonce / gas / fee fields; result returns a `sendTransactionStatusId` for polling.
- `upsertSwapConfig` (`POST /public/v1/submit/upsert_swap_config`, `ACTIVITY_TYPE_UPSERT_SWAP_CONFIG`) — enable or update org swap config (`feeReceiverWalletAddress`, `feeBps`, and Enterprise-only `stableFeeBps` for stablecoin pairs).
- `createSwapQuote` (`ACTIVITY_TYPE_CREATE_SWAP_QUOTE`) — request provider quotes for a swap (`signWith`, CAIP-19 `inputToken` / `outputToken`, `inputAmount`, optional `slippageBps`). Returns one or more `v1SwapQuote` values; pass `quoteId` into execute-swap v2.

### Related activity / type updates

- `ACTIVITY_TYPE_EXECUTE_SWAP_V2` / `v1ExecuteSwapIntentV2` — quote-bound swap execution. Takes `quoteId` plus the exact quoted amounts (`inputAmount`, `quotedOutputAmount`, `minOutputAmount`, `sponsor`), with optional `evmNonce` / `recentBlockhash` / `gasStationNonce`. Signer is derived from the quote and must not be resupplied. Result still exposes `swapRequestId` for `getSwapStatus`.
- `ACTIVITY_TYPE_UPDATE_WALLET_ACCOUNT_NAME` / `v1UpdateWalletAccountNameIntent` — rename a wallet account by `walletAccountId`.
- Supporting swap types: `v1SwapQuote`, `v1SwapError`, `v1SwapRefund`.
- CAIP-2 enums used by transaction intents (including undelegation) now include `eip155:143`.

These surfaces are generated into `@turnkey/http`, `@turnkey/sdk-types`, `@turnkey/sdk-browser`, `@turnkey/sdk-server`, and `@turnkey/core`.
