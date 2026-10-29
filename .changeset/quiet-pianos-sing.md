---
"@turnkey/core": minor
"@turnkey/react-wallet-kit": minor
"@turnkey/react-native-wallet-kit": minor
"@turnkey/http": minor
"@turnkey/sdk-browser": minor
"@turnkey/sdk-server": minor
"@turnkey/sdk-types": minor
---

Sync generated clients and types with the latest public API.

- Add `getWalletAuthenticators` (`POST /public/v1/query/get_wallet_authenticators`), `createWalletAuthenticators`, `deleteWalletAuthenticators`, and `verifyWalletAuthenticator` (plus `stamp*` variants). `v1WalletAuthenticatorParams` accepts an optional `verificationToken`.
- Add `createExternalSigner` and `deleteExternalSigner` (plus `stamp*` variants). `createPrivateKeys` accepts an optional `externalSignerWrappingKeyId`.
- Add `createFiatRampCredential` and `updateFiatRampCredential` (plus `stamp*` variants).
- Fiat quotes and credentials now use the shared ramp types. `v1FiatOnRampAmount` is `v1FiatRampAmount`. On-ramp quote `onrampProvider` is `provider` (`v1FiatRampProvider`, which includes Meld). Quote `fiatCurrencyCode` and `paymentMethod` use `v1FiatRampCurrency` and `v1FiatRampPaymentMethod`. Credential `fiatOnrampCredentialId` is `credentialId`, and `publishableApiKey` / `encryptedSecretApiKey` are `apiKey` / `encryptedSecret`. `projectId` and `encryptedPrivateApiKey` are removed. `FIAT_ON_RAMP_PROVIDER_MELD` is removed from `v1FiatOnRampProvider`.
- Generated activity types include `ACTIVITY_TYPE_EXECUTE_SWAP_V4` (`v1ExecuteSwapIntentV4`), `ACTIVITY_TYPE_ENABLE_SMS_FOR_COUNTRIES`, and `ACTIVITY_TYPE_DISABLE_SMS_FOR_COUNTRIES`. `executeSwap` results include optional `outputAmount`, `minOutputAmount`, `feeSponsorship`, and `fixedRate`. `setOrganizationFeature` `value` is optional. `AUTHENTICATOR_TRANSPORT_SMART_CARD` is added.
- `@turnkey/core`: add auth proxy `proxySignupV3` (`POST /v1/signup_v3`) and `proxyVerifyWalletAuthenticator` (`POST /v1/verify_wallet_authenticator`).
