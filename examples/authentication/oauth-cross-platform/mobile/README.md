# Example: `oauth-cross-platform` — Mobile (Part 2)

> **Prerequisite:** Complete [Part 1 (web)](../web/README.md) first. The mobile app logs in to the sub-org created there, it does not create accounts on its own.

A React Native (Expo) app that demonstrates logging in with Google using the iOS or Android client ID pre-registered during web sign-up. No extra onboarding required.

## How it works

This app uses `expo-web-browser` to open a Google OAuth PKCE flow in the platform system browser (`ASWebAuthenticationSession` on iOS, Custom Tab on Android). The resulting OIDC token has `aud = IOS_CLIENT_ID` or `aud = ANDROID_CLIENT_ID` depending on the platform. Because those audiences were registered as `oidcClaims` entries during web sign-up, Turnkey finds the same sub-org and login succeeds without the need for a separate onboarding.

The flow in `app/index.tsx`:

```ts
const publicKey = await createApiKeyPair();
const nonce = bytesToHex(sha256(publicKey)); // hex: stored verbatim in the JWT

// Open Google OAuth in platform system browser
await WebBrowser.openAuthSessionAsync(googleAuthUrl, redirectUri);

// Exchange auth code for tokens, then complete with Turnkey
// id_token.aud = IOS_CLIENT_ID | ANDROID_CLIENT_ID, id_token.nonce = hex(sha256(publicKey))
await completeOauth({ oidcToken: tokens.id_token, publicKey });
```

`completeOauth` looks up the sub-org by token, logs in if it exists, or creates a new one if not.

> **Why not native Google Sign-In?** The native iOS Google Sign-In SDK (`@react-native-google-signin`) automatically SHA256-hashes and base64url-encodes the nonce before storing it in the JWT. Turnkey expects the nonce as a hex-encoded SHA256, making the two incompatible. The `expo-web-browser` approach passes the nonce verbatim through the browser, producing the correct format.

## Prerequisites

- **iOS:** Xcode (macOS only)
- **Android:** Android Studio with an emulator or a physical device with USB debugging enabled
- An auth proxy configured for your Turnkey org

## Setup

### 1. Install

```bash
cd examples/authentication/oauth-cross-platform/mobile
npm install
```

### 2. Set platform URL schemes in `app.json`

**iOS:** Replace `REPLACE_WITH_REVERSED_IOS_CLIENT_ID` in `ios.infoPlist.CFBundleURLTypes` with the reversed form of your iOS client ID. For example, if your iOS client ID is `123456789-abc.apps.googleusercontent.com`, the reversed scheme is `com.googleusercontent.apps.123456789-abc`.

**Android:** No changes needed — the Android intent filter in `app.json` already uses the package name (`xyz.tkhqlabs.oauthcrossplatform`) as the redirect scheme. Your Android OAuth client in Google Cloud must be configured with this package name and your app's SHA-1 signing fingerprint, and the **Custom URI scheme** option must be enabled — this is required for browser-based PKCE redirects back to the app.

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable                                   | Description                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID`      | Same parent org ID as the web app                                        |
| `EXPO_PUBLIC_TURNKEY_API_BASE_URL`         | `https://api.turnkey.com`                                                |
| `EXPO_PUBLIC_TURNKEY_AUTH_PROXY_URL`       | `https://authproxy.turnkey.com`                                          |
| `EXPO_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID` | Your auth proxy config ID (Dashboard → Embedded Wallets → Configuration) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`         | Google OAuth iOS client ID                                               |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`     | Google OAuth Android client ID                                           |

### 4. Build and run

```bash
npx expo prebuild

# iOS
npx expo run:ios

# Android
npx expo run:android
```

### 5. Try it

1. Sign up in the web app with a Google account
2. Open the mobile app and tap **Continue with Google** using the same account
3. The dashboard shows the same sub-org ID, OIDC subject, and wallets as the web app. The login resolved the same account via `OAUTH_CLAIM` lookup with no extra steps

## Delete account

The app includes a **Delete account** button for testing convenience. Deleting a sub-organization can only be initiated by the authenticated user from within the app, so the button exists to make it easy to reset a test account and sign up again.

> 🚨 **Warning:** It calls `deleteSubOrganization` with `deleteWithoutExport: true`, which **permanently and irreversibly deletes the sub-organization and all associated wallets**, even if private keys have never been exported. See the [root README](../README.md#testing-convenience-delete-account) for the full warning.
