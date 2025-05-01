---
"@turnkey/sdk-react": patch
---

- Added `openOAuthInPage` to the `authConfig`. This makes the Google, Apple and Facebook login pages replace the current URL, rather than opening in a popup.
- Fixed keyboard input type on mobile. Now, the keyboard will correctly default to "number" input for numeric OTP codes and "text" input for alphanumeric OTP codes.
