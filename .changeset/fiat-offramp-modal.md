---
"@turnkey/sdk-browser": minor
"@turnkey/sdk-server": minor
"@turnkey/sdk-types": minor
"@turnkey/core": minor
"@turnkey/react-wallet-kit": minor
---

Add fiat off-ramp quotes and sessions to the SDK clients, and a cash-out modal in `@turnkey/react-wallet-kit`.

`getFiatOffRampQuotes` quotes Coinbase and MoonPay for a crypto amount, CAIP-19 asset, and fiat currency. `createFiatOffRampSession` opens a saved quote and returns `offRampUrl` plus `offRampTransactionId`. `handleOffRamp` opens the sell modal: pick Card, ACH transfer, or a fiat account, enter the crypto amount, choose a quote, and open the provider widget. Card and ACH each match one payout method. A fiat account matches Coinbase's fiat wallet and MoonPay's balance, so both providers can appear. The next screen sends from the wallet passed to `handleOffRamp`, on the network that provider settles. MoonPay fills that deposit address on the original sell screen when the user clicks Send with, then the provider window closes. Live mode uses the quoted asset's network. MoonPay sandbox sends Sepolia ETH, Sepolia MoonPayToken for ERC-20s, or Solana devnet SOL. Coinbase offramp quotes are omitted in sandbox mode.
