---
"@turnkey/react-wallet-kit": minor
"@turnkey/sdk-types": minor
---

- **Added `handleOnRamp()` helper** to simplify fiat-to-crypto on-ramping flows directly from the SDK.
  - Supports overriding defaults through optional parameters:
    - `network` (e.g., `FiatOnRampBlockchainNetwork.ETHEREUM`)
    - `cryptoCurrencyCode` (e.g., `FiatOnRampCryptoCurrency.ETHEREUM`)
    - `fiatCurrencyAmount`, `fiatCurrencyCode`, `paymentMethod`, and `onrampProvider`.
  - Integrates seamlessly with the `client.httpClient.initFiatOnRamp()` method to open a provider popup (Coinbase, MoonPay, etc.) and monitor transaction completion.
