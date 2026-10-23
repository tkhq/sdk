---
"@turnkey/sdk-browser": minor
"@turnkey/sdk-server": minor
"@turnkey/sdk-types": minor
"@turnkey/core": minor
"@turnkey/react-wallet-kit": minor
---

Add fiat off-ramp quotes and sessions to the SDK clients, and a cash-out modal in `@turnkey/react-wallet-kit`.

`getFiatOffRampQuotes` quotes Coinbase and MoonPay for a crypto amount, CAIP-19 asset, and fiat currency. `createFiatOffRampSession` opens a saved quote and returns `offRampUrl` plus `offRampTransactionId`. `handleOffRamp` opens the sell modal: pick a payout method, enter the crypto amount, choose a quote, then complete the provider widget.
