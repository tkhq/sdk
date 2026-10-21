---
"@turnkey/http": patch
"@turnkey/sdk-browser": patch
---

Stop activity polling when additional authenticators are required. Read-only login and session refresh now reject incomplete activities before storing a session, preserving the existing session and structured activity errors. Re-export `TurnkeyActivityConsensusNeededError` from `@turnkey/sdk-browser` so callers can handle consensus errors.
