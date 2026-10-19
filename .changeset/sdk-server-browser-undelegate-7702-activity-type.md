---
"@turnkey/sdk-server": patch
"@turnkey/sdk-browser": patch
---

- Fixed `ethUndelegate7702()` and `stampEthUndelegate7702()` sending the invalid activity type `ACTIVITY_TYPE_ETH_UNDELEGATE7702`, which the API rejected with "Invalid activity type". They now send `ACTIVITY_TYPE_ETH_UNDELEGATE_7702`, matching `@turnkey/core`. The codegen now reads activity types from the API spec instead of deriving them from the method name
