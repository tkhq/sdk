---
"@turnkey/react-wallet-kit": patch
---

Only render the OTP screen's Turnstile widget when the user requests a new code; submitting the code never used it.
