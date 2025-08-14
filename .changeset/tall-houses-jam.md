---
"@turnkey/sdk-react": patch
---

- Add optional `includeUnverifiedSubOrgs` to `otpConfig` in the Auth component to allow inclusion of unverified subOrgs
- Fix `customAccounts` being ignored for subOrgs created through OTP and external wallets
