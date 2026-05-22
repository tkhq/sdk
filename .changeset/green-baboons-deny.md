---
"@turnkey/sdk-browser": minor
"@turnkey/sdk-server": minor
"@turnkey/sdk-types": minor
"@turnkey/core": minor
"@turnkey/http": minor
---

### Breaking/Behavioral Changes

#### `nonce` parameter in `oauth2Authenticate` is now required

```ts
# Before
apiClient.oauth2Authenticate({
  oauth2CredentialId: ...,
  authCode: ...,
  redirectUri: ...,
  codeVerifier: ...,
  bearerTokenTargetPublicKey: ...,
  // nonce can be undefined
  nonce: undefined
})

# After
apiClient.oauth2Authenticate({
  oauth2CredentialId: ...,
  authCode: ...,
  redirectUri: ...,
  codeVerifier: ...,
  bearerTokenTargetPublicKey: ...,
  // nonce is required
  nonce: ""
})
```

#### Solana transactions in Transaction Management are now limited to the following `caip2` values:

- `solana:mainnet`
- `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`
- `solana:devnet`
- `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`
- `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`

### New SDK methods

#### TVC

These methods will only work if you are part of the [TVC beta](https://www.turnkey.com/turnkey-verifiable-cloud#waitlist)

- `getTvcApp`
- `getTvcDeployment`
- `getTvcAppDeployments`
- `getTvcApps`
- `validateTvcImage`
- `createTvcApp`
- `createTvcDeployment`
- `createTvcManifestApprovals`
- `deleteTvcAppAndDeployments`
- `deleteTvcDeployment`
- `restoreTvcDeployment`
- `updateTvcAppLiveDeployment`

#### Spark protocol support

- `sparkClaimTransfer`
- `sparkPrepareLightningReceive`
- `sparkPrepareTransfer`
- `sparkSignFrost`
