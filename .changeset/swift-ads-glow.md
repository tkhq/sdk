---
"@turnkey/wallet-stamper": major
"@turnkey/sdk-browser": minor
"@turnkey/sdk-react": minor
"@turnkey/crypto": minor
---

`@turnkey/wallet-stamper`

- Renamed `recoverPublicKey` to `getPublicKey` and standardized its signature, improving clarity and simplifying the process of retrieving public keys across wallet interfaces.

`@turnkey/sdk-browser`

- Added `TurnkeyWalletClient` with a new `getPublicKey` method, supporting easier public key access and integration with `WalletStamper`.
- Added `UserSession` interface and `authClient` to track which client was used to authenticate a session

`@turnkey/crypto`

- Added `toDerSignature` function used to convert a raw ECDSA signature into DER-encoded format for compatibility with our backend, which requires DER signatures

`@turnkey/sdk-react`

- The `useTurnkey` hook now returns the new `walletClient`, used for authenticating requests via wallet signatures
