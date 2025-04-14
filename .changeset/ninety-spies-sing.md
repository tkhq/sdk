---
"@turnkey/sdk-react-native": patch
---

- Adds optional parameter for createEmbeddedKey():
  - You can now pass a sessionKey to createEmbeddedKey() to generate separate embedded keys for different sessions, which is helpful when running multiple authentication flows concurrently.
- Introduces onSessionExpiryWarning():
  - You can now add a callback via the provider config that triggers 15 seconds before a session expires.
- Introduces refreshSession():
  - You now can refresh an active session that is about to expire.
