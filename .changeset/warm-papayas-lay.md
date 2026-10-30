---
"@turnkey/react-wallet-kit": minor
---

Replaced the `handleOnRamp()` provider popup with a funding modal, and added `handleOffRamp()`.

`handleOnRamp()` lets the user fund a wallet with cash or with crypto from a connected external wallet. Cash quotes enabled onramp providers, opens the provider widget in a popup or tab, and polls until the purchase completes. Crypto asks which external wallet account to use on the chain already in play, then sends that transfer.

`handleOffRamp()` lets the user sell crypto for cash. They pick Card, ACH, or a fiat account, then an amount, token, and quote. The provider widget opens, and after it returns a deposit address the passed wallet sends the crypto.

`handleOnRamp` parameters have been completely changed since the last version:

Before:

- `walletAccount`, `network`, `cryptoCurrencyCode`, `fiatCurrencyCode`, `fiatCurrencyAmount`, `onrampProvider`, `paymentMethod`, `countryCode`, `countrySubdivisionCode`, `sandboxMode`, `urlForSignature`, `organizationId`, `userId`, `stampWith`, `successPageDuration`, `openInNewTab`

After:

- `walletAccount`, `lockedCaip2`, `lockedCaip19`, `fiatCurrencyCode`, `defaultFiatCurrencyAmount`, `countryCode`, `countrySubdivisionCode`, `sandboxMode`, `organizationId`, `stampWith`, `successPageDuration`, `openInNewTab`, `rpcUrl`
