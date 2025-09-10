---
"@turnkey/react-wallet-kit": minor
---

Added config option to disable managed state auto refreshing. Sessions now expire automatically when the session keypair is rendered invalid (ex: When a user has >10 sessions active, the earliest session is invalidated)
