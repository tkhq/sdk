---
"@turnkey/react-wallet-kit": minor
"@turnkey/core": minor
---

- Added `defaultStamperType` param to the configuration. This will force the underlying `httpClient` to default to a specific stamper for all requests
- Added `createHttpClient` function. This allows a duplicate instance of `TurnkeySDKClientBase` to be created and returned. Custom configuration can be passed in to create an entirely new client with a unique config. This is useful for creating different HTTP clients with different default stampers to be used in our helper packages (`@turnkey/viem`, `@turnkey/ethers`, etc)
