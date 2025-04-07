---
"@turnkey/viem": minor
---

- Add support for EIP 7702 (Type 4) transactions by way of a new `signAuthorization` method
- Update upstream `viem` version to `^2.24.2` (required for 7702)
- Introduce new `to` parameter, used for indicating the result shape of `signMessage` (and related) requests
  - Affects `signTypedData` as well
  - Is used by `signAuthorization`
  - As a result, `serializeSignature` is updated as well
