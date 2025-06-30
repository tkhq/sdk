# **@turnkey/sdk-react-native**

[![npm](https://img.shields.io/npm/v/@turnkey/sdk-react-native?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/sdk-react-native)

The `@turnkey/sdk-react-native` package simplifies the integration of the Turnkey API into React Native applications. It provides secure session management, authentication, and cryptographic operations.

---

## **Installation**

- Install the following dependencies in your React Native project:
  - [`react-native-keychain`](https://www.npmjs.com/package/react-native-keychain)
  - [`react-native-inappbrowser-reborn`](https://www.npmjs.com/package/react-native-inappbrowser-reborn)
  - [`react-native-passkey`](https://www.npmjs.com/package/react-native-passkey)
  - [`@turnkey/api-key-stamper`](../api-key-stamper/)
  - [`@turnkey/crypto`](../crypto/)
  - [`@turnkey/http`](../http/)
  - [`@turnkey/react-native-passkey-stamper`](../react-native-passkey-stamper/)
  - `@turnkey/sdk-react-native` (this package)
- Ensure your app is properly configured for secure storage and authentication.
- **You must polyfill random byte generation** to ensure `generateP256KeyPair` from `@turnkey/crypto` works properly by importing [`react-native-get-random-values`](https://www.npmjs.com/package/react-native-get-random-values) at the **entry point of your application**:

  ```tsx
  import "react-native-get-random-values";
  ```

---

---

## **⚠️ Android InAppBrowser Bug (Fix Required)**

If you're using `react-native-inappbrowser-reborn` on Android, you may encounter the following **build error**:

```
Dependency 'androidx.browser:browser:1.9.0-alpha05' requires libraries and applications that
depend on it to compile against version 36 or later of the Android APIs.
```

This is a known issue: [GitHub Issue #475](https://github.com/proyecto26/react-native-inappbrowser/issues/475)

### ✅ Fix

#### For plain React Native:

In your `android/build.gradle`, add the following:

```groovy
buildscript {
    ext {
        androidXBrowser = "1.8.0"
    }
}
```

#### For Expo:

Run:

```bash
npx expo install expo-gradle-ext-vars
```

Then update your `app.json` (or `app.config.js`) to include:

```json
{
  "plugins": [
    [
      "expo-gradle-ext-vars",
      {
        "androidXBrowser": "1.8.0"
      }
    ]
  ]
}
```

---

## **Usage**

### **Wrapping Your App with the Provider**

```tsx
import { TurnkeyProvider } from "@turnkey/sdk-react-native";
import { useRouter } from "expo-router";
import React from "react";

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();

  const turnkeyConfig = {
    apiBaseUrl: "https://api.turnkey.com",
    organizationId: "<your organization id>",
    onInitialized: () => {
      console.log("Context initialized");
    },
    onSessionEmpty: () => {
      console.log("No active session on app launch");
    },
    onSessionCreated: (session) => {
      console.log("Session Created", session);
    },
    onSessionSelected: (session) => {
      console.log("Session Selected", session);
      router.replace("/dashboard");
    },
    onSessionExpired: (session) => {
      console.log("Session Expired", session);
      router.push("/");
    },
    onSessionCleared: (session) => {
      console.log("Session Cleared", session);
      router.push("/");
    },
    onSessionExpiryWarning: (session) => {
      console.log("Session is expiring in 15 seconds", session);
    },
  };

  return <TurnkeyProvider config={turnkeyConfig}>{children}</TurnkeyProvider>;
};
```

---

## **Session Storage**

To enable secure authentication, the following storage keys are used:

- `@turnkey/embedded-key`: Stores the private key that corresponds to the public key used when initiating the session request to Turnkey.
- `@turnkey/session`: Default session storage key, storing the session credentials, including the private key, public key, and expiry time, which are decrypted from the credential bundle after a session is created.
- `@turnkey/session-keys`: Stores the list of stored session keys.
- `@turnkey/selected-session`: Stores the currently selected session key.

---

## **Functions Provided by the Turnkey Provider**

### **Session Management**

- `createEmbeddedKey({ storageKey?, isCompressed? })`: Generates a new embedded key pair and securely stores the private key.
  - If `storageKey` is provided, the embedded key will be stored under that key in secure storage.
  - If `isCompressed` is set to `true`, the compressed public key is returned; otherwise, the uncompressed public key is returned.
  - This allows for creating different embedded keys for different sessions, which is useful when initiating multiple authentication flows simultaneously.
- `createSession({ bundle, expirationSeconds?, sessionKey?, embeddedStorageKey? })`: Creates a session. [(API Docs)](https://docs.turnkey.com/api#tag/Sessions/operation/CreateReadWriteSession)
  - If `sessionKey` is provided, the session will be stored under that key in secure storage.
  - If `embeddedStorageKey` is provided, the session will use the embedded key stored under that service name instead of the default. This allows creating sessions from different embedded keys.
  - If no session exists, the first session created is **automatically selected**.
  - If a session with the same `sessionKey` already exists in secure storage, an error is thrown.
- `createSessionFromEmbeddedKey({ subOrganizationId, embeddedKey?, expirationSeconds?, sessionKey? })`: Creates a session directly using the embedded private key. [(API Docs)](https://docs.turnkey.com/api#tag/Sessions/operation/CreateReadWriteSession)
  - If `embeddedKey` is provided, it will be used directly; otherwise, the embedded key will be retrieved from secure storage.
  - If `sessionKey` is provided, the session will be stored under that key in secure storage.
  - If `embeddedStorageKey` is provided, the session will use the embedded key stored under that service name instead of the default. This allows creating sessions from different embedded keys. This is only used if `embeddedKey` is not provided
  - If no session exists, the first session created is **automatically selected**.
  - If a session with the same `sessionKey` already exists in secure storage, an error is thrown.
- `refreshSession({ expirationSeconds?, sessionKey? })`: Refreshes and extends the expiration time of an existing session.
  - Uses the current session to create a new session with an updated expiration time.
  - If `sessionKey` is not provided, the currently selected session is refreshed.
  - If `expirationSeconds` is not provided, the default expiration time is used.
- `setSelectedSession({ sessionKey })`: Selects a session by its key (Used when handling multiple sessions).
- `clearSession({ sessionKey? })`: Removes the specified session from secure storage. If no `sessionKey` is provided, the currently selected session is removed.
- `clearAllSessions()`: Clears all sessions from secure storage.

---

### **User Management**

- `updateUser({ email?, phone? })`: Updates the user's email and/or phone number. [(API Docs)](https://docs.turnkey.com/api#tag/Users/operation/UpdateUser)
- `refreshUser()`: Fetches the latest user data. [(API Docs)](https://docs.turnkey.com/api#tag/Sessions)

---

### **Wallet Management**

- `createWallet({ walletName, accounts, mnemonicLength? })`: Creates a wallet. [(API Docs)](https://docs.turnkey.com/api#tag/Wallets/operation/CreateWallet)
- `importWallet({ walletName, mnemonic, accounts })`: Imports a wallet. [(API Docs)](https://docs.turnkey.com/api#tag/Wallets/operation/ImportWallet)
- `exportWallet({ walletId })`: Exports a wallet mnemonic. [(API Docs)](https://docs.turnkey.com/api#tag/Wallets/operation/ExportWallet)

---

### **Transaction Signing**

- `signRawPayload({ signWith, payload, encoding, hashFunction })`: Signs a payload. [(API Docs)](https://docs.turnkey.com/api#tag/Signing/operation/SignRawPayload)

---

### **OAuth**

- `handleGoogleOAuth({ clientId, redirectUri, nonce, scheme, onIdToken })`: Handles the Google OAuth authentication flow.

---

## **Handling Multiple Sessions**

Most users won't need multiple sessions, but if your app requires switching between multiple sessions, here’s what you need to know:

This SDK supports **multiple sessions**, allowing you to create and switch between different session keys using `setSelectedSession({ sessionKey })`. When a session is selected, the client, user, and session information are updated accordingly, so that all subsequent function calls (like `updateUser` or `createWallet`) apply to the selected session.

- **Creating a Session with a Custom Id**: You can pass a `sessionKey` when calling `createSession`. If provided, the session will be stored in secure storage under that ID, allowing for multiple sessions.
- **Switching Sessions**: Use `setSelectedSession({ sessionKey })` to switch between stored sessions. The client, user, and session information will automatically update.
- **Session Expiry Management**: Each session has an expiry time, and expired sessions will be automatically cleared.
- **Callbacks for Session Events**:
  - `onInitialized`: Called once context initialization is complete.
  - `onSessionEmpty`: Called when there is no active session on app launch.
  - `onSessionCreated`: Called when a session is created.
  - `onSessionSelected`: Called when a session is selected.
  - `onSessionExpired`: Called when a session expires.
  - `onSessionCleared`: Called when a session is cleared.
  - `onSessionExpiryWarning`: Called 15 seconds before a session expires, giving you an opportunity to refresh the session or notify the user.

**When are multiple sessions useful?**

Using multiple sessions can be beneficial when enabling different authentication methods for various operations. For example, you might authenticate a user with OTP for login while using a passkey-based session for signing transactions.

---

## **Demo App**

Check out [this repository](https://github.com/tkhq/react-native-demo-wallet) for a full working example.

---
