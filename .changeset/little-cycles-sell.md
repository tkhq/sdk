---
"@turnkey/react-native-wallet-kit": patch
---

Remove build-time dependency on react-native-device-info due to incompatibility with expo.

Instead of using `DeviceInfo.getApplicationName/getBundleId()`, `TurnkeyProvider` now has an additional optional prop `applicationName` that allows the consumer to provide the name. This ensures maximum compatibility with the consumer ecosystem.
