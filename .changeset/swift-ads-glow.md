---
"@turnkey/wallet-stamper": major
"@turnkey/sdk-browser": minor
"@turnkey/sdk-react": minor
"@turnkey/crypto": minor
---

`@turnkey/wallet-stamper`

- Renamed `recoverPublicKey` to `getPublicKey` and standardized its signature, improving clarity and simplifying the process of retrieving public keys across wallet interfaces.
- Added [`EthereumWallet`](https://github.com/tkhq/sdk/blob/830c3bc68a8a14ef21d1398c1f939994b90dd08d/packages/wallet-stamper/src/ethereum.ts) interface to simplify support for Ethereum wallets

`@turnkey/sdk-browser`

- Added `TurnkeyWalletClient` with a new `getPublicKey` method, supporting easier public key access and integration with `WalletStamper`.
- Added `UserSession` interface and `authClient` to track which client was used to authenticate a session

`@turnkey/crypto`

- Added `toDerSignature` function used to convert a raw ECDSA signature into DER-encoded format for compatibility with our backend, which requires DER signatures

`@turnkey/sdk-react`

- The `useTurnkey` hook now returns the new `walletClient`, used for authenticating requests via wallet signatures
