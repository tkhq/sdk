---
"@turnkey/react-wallet-kit": minor
---

Added optional `openInPage` boolean parameter to `handleAddOauthProvider` which open the oAuth flow in the current page (redirect). This respects the `openInPage` value passed into the `TurnkeyConfig` and defaults to `true` on mobile devices.

Twitter oAuth credentials created from `handleXOauth` or `handleAddOauthProvider` will now be stored with the `providerName` `"x"` in the user's `oauthProviders` list. This only affects new credentials.
