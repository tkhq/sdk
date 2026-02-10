---
"@turnkey/core": patch
"@turnkey/http": patch
---

Add `Content-Type: application/json` header to all Turnkey API requests. The missing header caused "Network request failed" errors on React Native, intermittent for some setups and consistent for others, where OkHttp-backed fetch can reject `POST` requests without an explicit `Content-Type`. See also: https://github.com/JakeChampion/fetch/issues/823

Special thanks to @jrmykolyn and @niroshanS for helping identify and debug this issue
