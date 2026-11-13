---
"@turnkey/react-wallet-kit": minor
---

Add the `onOtpVerified` callback. When set, the auth modal hands a verified email or SMS code over to the host instead of completing the login in the SDK: the SDK generates the API key pair and verifies the code with the auth proxy, then calls `onOtpVerified({ verificationToken, publicKey, contact, otpType, sessionKey? })`. The host finishes the login itself (for example through its own backend) and stores the session with `storeSession`. The modal closes when the callback resolves; when it rejects, the modal shows the error and the generated key pair is deleted. This is the OTP counterpart of `onOauthRedirect`.

Add the `onWalletConnected` callback. When set, the auth modal hands a connected external wallet over to the host instead of completing the login in the SDK: the SDK connects the wallet the user picked, then calls `onWalletConnected({ walletProvider, account, sessionKey? })`. The host finishes the login itself (for example by having the account sign a message for its own backend) and stores the session with `storeSession`. The modal closes when the callback resolves; when it rejects, the modal stays open, as it does when the wallet login fails. This is the wallet counterpart of `onOauthRedirect`.
