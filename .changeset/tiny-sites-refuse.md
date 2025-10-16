---
"@turnkey/react-wallet-kit": minor
---

- Added `verifyAppProofs` function. Used alongside activities that return app proofs, this function will fetch the corresponding boot proof for a list of app proofs and securely verify them on the client. Learn more about Turnkey Verified [here](https://docs.turnkey.com/security/turnkey-verified)

- All auth methods that make signup requests now optionally return a list of `appProofs`

- Added `handleVerifyAppProofs` function. This will do the same actions as `verifyAppProofs` but will also show a loading and confirmation modal

- Added `verifyWalletOnSignup` param to the `TurnkeyProvider` config. This will automatically run `handleVerifyAppProofs` after a successful signup
