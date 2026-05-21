---
"@turnkey/sdk-browser": major
"@turnkey/sdk-server": major
"@turnkey/sdk-types": major
"@turnkey/core": major
"@turnkey/http": major
---

- Makes `nonce` parameter in `oauth2Authenticate` method parameters required.
- Solana transactions are now limited to the following `caip2`:
  - `solana:mainnet`
  - `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
  - `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`
  - `solana:devnet`
  - `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`
  - `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`
- Introduces new SDK methods:
  - TVC
    - `getTvcApp`
    - `stampGetTvcApp`
    - `getTvcDeployment`
    - `stampGetTvcDeployment`
    - `getTvcAppDeployments`
    - `stampGetTvcAppDeployments`
    - `getTvcApps`
    - `stampGetTvcApps`
    - `validateTvcImage`
    - `stampValidateTvcImage`
    - `createTvcApp`
    - `stampCreateTvcApp`
    - `createTvcDeployment`
    - `stampCreateTvcDeployment`
    - `createTvcManifestApprovals`
    - `stampCreateTvcManifestApprovals`
    - `deleteTvcAppAndDeployments`
    - `stampDeleteTvcAppAndDeployments`
    - `deleteTvcDeployment`
    - `stampDeleteTvcDeployment`
    - `restoreTvcDeployment`
    - `stampRestoreTvcDeployment`
    - `updateTvcAppLiveDeployment`
    - `stampUpdateTvcAppLiveDeployment`
  - Spark protocol support
    - `sparkClaimTransfer`
    - `stampSparkClaimTransfer`
    - `sparkPrepareLightningReceive`
    - `stampSparkPrepareLightningReceive`
    - `sparkPrepareTransfer`
    - `stampSparkPrepareTransfer`
    - `sparkSignFrost`
    - `stampSparkSignFrost`
