# Example: `oauth-cross-platform` — Mobile (Part 2)

> **Prerequisite:** Complete [Part 1 (web)](../web/README.md) first. The mobile app logs in to the sub-org created there — it does not create accounts on its own.

This is the React Native (Expo) counterpart to the web example. It demonstrates that a user who signed up on the web can log in on mobile without any extra setup, because their iOS/Android OAuth identities were pre-registered as `oidcClaims` during web sign-up.

## How it works

When the React Native wallet kit performs a Google sign-in, the OIDC token it receives has your mobile `aud` (e.g. `com.yourapp.ios`). Because that audience was registered as an unverified claim at web sign-up time, `getSubOrgIds` with `filterType: "OAUTH_CLAIM"` finds the same sub-org — and login proceeds normally.

The only Turnkey-specific config change vs a standard React Native OAuth setup is adding `secondaryClientIds` to the provider config:

```ts
// constants/turnkey.ts
export const TURNKEY_CONFIG: TurnkeyProviderConfig = {
  organizationId: process.env.EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID!,
  apiBaseUrl: process.env.EXPO_PUBLIC_TURNKEY_API_BASE_URL!,
  authProxyUrl: process.env.EXPO_PUBLIC_TURNKEY_AUTH_PROXY_URL!,
  auth: {
    oauth: {
      google: {
        primaryClientId: {
          webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        },
        // Registers iOS + Android audiences as unverified claims at sign-up,
        // so mobile users can find their account without a separate onboarding step.
        secondaryClientIds: [
          process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!,
          process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID!,
        ].filter(Boolean),
      },
    },
  },
};
```

The wallet kit calls `buildSecondaryOauthProviders` internally and passes the `oidcClaims` entries to `createSubOrganization` — the same thing the web server action does manually.

## Prerequisites

- **iOS:** Xcode (macOS only)
- **Android:** Android Studio with an emulator, or a physical device with USB debugging enabled
- Expo CLI: `npm install -g expo-cli`
- An auth proxy configured for your Turnkey org (required by the React Native wallet kit)

## Setup

### 1. Start from the existing React Native wallet kit example

The simplest path is to copy `examples/with-react-native-wallet-kit` and add the `secondaryClientIds` config shown above.

```bash
cp -r examples/with-react-native-wallet-kit examples/oauth-cross-platform/mobile/app
cd examples/oauth-cross-platform/mobile/app
```

### 2. Configure environment

Create `.env.local` (Expo uses `EXPO_PUBLIC_` prefix):

```
EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID="<same org ID as web>"
EXPO_PUBLIC_TURNKEY_API_BASE_URL="https://api.turnkey.com"
EXPO_PUBLIC_TURNKEY_AUTH_PROXY_URL="<your auth proxy URL>"
EXPO_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID="<your auth proxy config ID>"
EXPO_PUBLIC_TURNKEY_RPID="<your passkey RP ID>"
EXPO_PUBLIC_APP_SCHEME="<your app scheme>"

EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="<same web client ID as web app>"
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID="<Google iOS client ID>"
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID="<Google Android client ID>"
```

### 3. Build and run

```bash
# iOS
npx expo prebuild
npx expo run:ios

# Android (requires Android Studio)
npx expo prebuild
npx expo run:android
```

### 4. Try it

1. Sign up in the web app (Part 1) with a Google account
2. Open the mobile app and tap **Sign in with Google** using the same account
3. The wallet kit resolves the same sub-org via `OAUTH_CLAIM` lookup — login succeeds with no extra steps
