---
"@turnkey/react-native-wallet-kit": minor
"@turnkey/core": minor
---

- Added `verifyAppProofs` function. Used alongside activities that return app proofs, this function will fetch the corresponding boot proof for a list of app proofs and securely verify them on the client. Learn more about Turnkey Verified [here](https://docs.turnkey.com/security/turnkey-verified)

- All auth methods that make signup requests now optionally return a list of `appProofs`
