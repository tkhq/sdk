---
"@turnkey/react-wallet-kit": minor
"@turnkey/core": minor
---

This branch adds first-class ERC20 transfer abstractions across `@turnkey/core` and `@turnkey/react-wallet-kit`.

### `@turnkey/core`
- Added `Erc20Transfer` and `EthSendErc20TransferParams` method types.
- Added `TurnkeyClient.ethSendErc20Transfer(...)` as a convenience wrapper that ABI-encodes `transfer(address,uint256)` and submits via `ethSendTransaction`.
- Updated `ethSendTransaction` to stop prefetching nonces with `getNonces`; transaction fields are now forwarded directly to Turnkey's coordinator (including optional caller-provided `nonce` / `gasStationNonce`).

### `@turnkey/react-wallet-kit`
- Added low-level `ethSendErc20Transfer(...)` passthrough in the client provider context.
- Added `handleSendErc20Transfer(...)` modal flow that submits ERC20 transfers and polls transaction status to terminal state.
- Added new public types/docs for `HandleSendErc20TransferParams` and `ClientContextType.handleSendErc20Transfer`.
