---
"@turnkey/sdk-server": minor
"@turnkey/sdk-browser": minor
"@turnkey/core": minor
"@turnkey/sdk-types": minor
"@turnkey/http": minor
---

Add Turnkey Earn APIs (early access) to the high-level SDK clients: `earnVaults`, `earnEnabledVaults`, `earnPositions`, `earnDeposit`, `earnDepositStatus`, `earnWithdraw`, `earnWithdrawStatus`, `earnDeployWrapper`, and `earnDeployStatus`.

The Earn read endpoints live under `/query/` but aren't named `get`/`list`/`test`/`validate`, so each package's codegen pins `/query/earn_*` to query methods by path. `@turnkey/http` gains the previously-missing `earnDeployStatus` so its generated Earn surface matches the other packages.
