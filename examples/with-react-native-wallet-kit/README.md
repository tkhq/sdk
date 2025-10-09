# Turnkey React Native Wallet Kit Demo

A comprehensive demonstration app showcasing the capabilities of [Turnkey's React Native Wallet Kit](https://www.turnkey.com/) for building embedded wallets in React Native applications.

## 🎯 Overview

This demo app illustrates how to integrate Turnkey's embedded wallet kit into a React Native application using Expo. It demonstrates secure wallet creation, management, and cryptographic operations without requiring users to manage private keys directly.

## ✨ Features

### Authentication & Session Management

- User authentication with Turnkey
  - Email OTP
  - Passkey
  - OAuth (Discord, Facebook, Google, X, Apple)
- Session persistence and expiry tracking
- Secure logout functionality

### Wallet Operations

- **Create Wallets**: Generate new HD wallets with multiple blockchain support
- **Manage Accounts**: Create additional accounts for existing wallets

### Cryptographic Operations

- **Message Signing**: Sign messages with wallet accounts
- **Export Wallets**: Securely export encrypted wallet bundles
- **Export Accounts**: Export individual account private keys with encryption

## 📋 Prerequisites

- **Node.js**: Version 18.0 or higher
- **npm**: Version 9.0 or higher
- **Expo CLI**: Install globally with `npm install -g expo-cli`
- **Development Environment**:
  - For iOS: Xcode and iOS Simulator (macOS only)
  - For Android: Android Studio and Android Emulator
  - Or use Expo Go app on physical device

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/tkhq/sdk.git
cd examples/with-react-native-wallet-kit
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root or run `cp .env.example .env` to copy the example file:

```env
# Turnkey Configuration
EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID=your_organization_id
EXPO_PUBLIC_TURNKEY_API_BASE_URL=https://api.turnkey.com
# Optional if using Auth Proxy
EXPO_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID=your_auth_proxy_config_id
# Passkey relying party ID (domain)
EXPO_PUBLIC_TURNKEY_RPID=passkeyapp.tkhqlabs.xyz
# App scheme for OAuth and deep links
EXPO_PUBLIC_APP_SCHEME=withreactnativewalletkit

# OAuth Configuration (Optional)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
EXPO_PUBLIC_APPLE_CLIENT_ID=your_apple_client_id
EXPO_PUBLIC_FACEBOOK_CLIENT_ID=your_facebook_client_id
EXPO_PUBLIC_X_CLIENT_ID=your_x_client_id
EXPO_PUBLIC_DISCORD_CLIENT_ID=your_discord_client_id
```

### 4. Configure Turnkey

You'll need to set up a Turnkey organization and obtain your organization ID. Visit [Turnkey Dashboard](https://app.turnkey.com) to create an account and organization.

Set `EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID` to your organization ID, and adjust other variables above as needed.

### Polyfills

This example applies `react-native-get-random-values` in `index.js` to support Web Crypto usage across dependencies. Keep this import at the app entrypoint.

## Passkey Setup

To enable passkeys, configure your app’s associated domains and RP ID.

### 1. Update `app.json` with associated domains and deep link scheme

The example already includes sane defaults tailored to this demo:

```json
{
  "expo": {
    "scheme": "withreactnativewalletkit",
    "ios": {
      "bundleIdentifier": "xyz.tkhqlabs.passkeyapp",
      "associatedDomains": ["webcredentials:passkeyapp.tkhqlabs.xyz"]
    },
    "android": {
      "package": "xyz.tkhqlabs.passkeyapp"
    }
  }
}
```

If you use a different domain or bundle IDs, update:

- iOS `associatedDomains` to `webcredentials:<your_domain>`
- iOS `bundleIdentifier` and Android `package`
- `EXPO_PUBLIC_APP_SCHEME` to your app scheme

For Apple Associated Domains, see Apple docs. For Android Digital Asset Links, create an `assetlinks.json` on your domain to verify association.

### 2. Set the RP ID (relying party ID)

Ensure your `.env` includes the passkey RP ID:

```ini
EXPO_PUBLIC_TURNKEY_RPID="<your_rpid_domain>"
```

This should match the domain configured in associated domains (e.g. `passkeyapp.tkhqlabs.xyz`).

## OAuth Setup

Turnkey’s OAuth flows use a fixed origin and redirect service. Configure your provider client IDs and ensure the redirect URI’s `scheme` matches your app.

### 1. Create a Google Web Client ID

- Go to Google Cloud Console and create an OAuth client.
- Authorized redirect URI (use your app scheme):

```
https://oauth-redirect.turnkey.com?scheme=withreactnativewalletkit
```

If you change the scheme, update both `app.json` (`expo.scheme`) and `EXPO_PUBLIC_APP_SCHEME` in `.env`.

### 2. Set your client IDs in `.env`

```ini
EXPO_PUBLIC_GOOGLE_CLIENT_ID="<your_google_web_client_id>"
# Optional: other providers
EXPO_PUBLIC_APPLE_CLIENT_ID="<your_apple_client_id>"
EXPO_PUBLIC_FACEBOOK_CLIENT_ID="<your_facebook_client_id>"
EXPO_PUBLIC_X_CLIENT_ID="<your_x_client_id>"
EXPO_PUBLIC_DISCORD_CLIENT_ID="<your_discord_client_id>"
```

## 📱 Running the App

### Development Mode

> Note (first-time setup): We recommend generating native projects before your first run, then launching iOS.
>
> ```bash
> # First-time only
> npm run prebuild   # or: npx expo prebuild
>
> # Then build and run for iOS
> npm run ios        # or: npx expo run:ios
> ```

Start the Expo development server:

```bash
npm run ios
```

This will open the Expo Developer Tools. From here you can:

- Press `i` to open in iOS Simulator
- Press `a` to open in Android Emulator
- Scan the QR code with Expo Go app on your phone

### Platform-Specific Commands

```bash
# iOS Simulator
npm run ios            # or: npx expo run:ios

# Android Emulator
npm run android        # or: npx expo run:android

# Web Browser (Limited functionality)
npm run web            # or: npx expo start --web
```

### Production Build

```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## 📁 Project Structure

```
with-react-native-wallet-kit/
├── app/
│   ├── (main)/
│   │   ├── _layout.tsx      # Main layout with tab navigation
│   │   └── index.tsx         # Home screen with wallet functionality
│   ├── _layout.tsx           # Root layout with Turnkey provider
│   └── index.tsx             # Authentication screen
├── components/               # Reusable UI components
├── constants/               # App configuration
│   └── turnkey.ts           # Turnkey configuration
├── package.json             # Dependencies and scripts
└── README.md               # This file
```

### Key Files

- **`app/(main)/index.tsx`**: Main wallet management interface
- **`app/index.tsx`**: Authentication entry point
- **`app/_layout.tsx`**: Turnkey provider setup
- **`constants/turnkey.ts`**: API configuration

## 🔧 Troubleshooting

### Common Issues

1. **Build Errors**
   ```bash
   # Clear cache and reinstall
   npm run clean
   npm install
   npx expo start -c
   ```

## 📄 License

This project is part of the Turnkey SDK and is licensed under the Apache License 2.0. See the [LICENSE](../../LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests to help improve this demo.

---

Built with ❤️ by [Turnkey](https://www.turnkey.com)
