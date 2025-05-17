---
"@turnkey/sdk-react-native": patch
---

There is no information from the context, that there is no active session available from the context. I added a callback function, which is invoked when useEffect in TurnkeyContext doesn't detect any active session.
