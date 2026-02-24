# React Wallet Kit Example

A comprehensive reference application demonstrating [`@turnkey/react-wallet-kit`](https://www.npmjs.com/package/@turnkey/react-wallet-kit) (the Embedded Wallet Kit / EWK). This example showcases authentication, embedded wallet management, message signing, wallet import/export, external wallet connections, and fiat on-ramp — all without requiring a custom backend.

## Getting Started

### Prerequisites

- Node.js 18+
- A [Turnkey](https://app.turnkey.com) organization
- An Auth Proxy configuration (created in the Turnkey Dashboard under **Auth**)

### Environment Setup

Copy the example env file and fill in your values:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_ORGANIZATION_ID` | Yes | Your Turnkey organization ID (from Dashboard) |
| `NEXT_PUBLIC_AUTH_PROXY_ID` | Yes | Auth Proxy config ID (from Dashboard > Auth) |
| `NEXT_PUBLIC_BASE_URL` | No | Turnkey API base URL (defaults to `https://api.turnkey.com`) |
| `NEXT_PUBLIC_AUTH_PROXY_URL` | No | Auth Proxy URL (defaults to `https://authproxy.turnkey.com`) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | [WalletConnect](https://cloud.walletconnect.com/) project ID (required for external wallet connections) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_URL` | No | Your application URL for WalletConnect metadata |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | No | Google OAuth client ID (for Google social login) |
| `NEXT_PUBLIC_FACEBOOK_CLIENT_ID` | No | Facebook OAuth client ID |
| `NEXT_PUBLIC_APPLE_CLIENT_ID` | No | Apple OAuth client ID |
| `NEXT_PUBLIC_OAUTH_REDIRECT_URI` | No | OAuth callback URL |

### Run

```bash
pnpm install
pnpm dev
```

The app launches at `http://localhost:3000`.

---

## How the Turnkey Integration Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  layout.tsx                                             │
│  ┌───────────────────────────────────────────────────┐  │
│  │ TurnkeyConfigProvider  (demo wrapper — manages    │  │
│  │ mutable config state + config panel UI)           │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ TurnkeyProvider  (@turnkey/react-wallet-kit)│  │  │
│  │  │                                             │  │  │
│  │  │  Provides: useTurnkey(), useModal()          │  │  │
│  │  │  Renders:  Auth modal, signing UI, iframes  │  │  │
│  │  │  ┌───────────────────────────────────────┐  │  │  │
│  │  │  │ page.tsx  (AuthPage)                  │  │  │  │
│  │  │  │  ├── UserSettings  (account + auth)   │  │  │  │
│  │  │  │  └── DemoPanel     (wallets + signing)│  │  │  │
│  │  │  └───────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

The integration is layered into three tiers:

1. **`TurnkeyProvider`** (from the SDK) — the core. Manages authentication state, wallet data, signing operations, and renders the auth/signing modal. Exposes everything through the `useTurnkey()` and `useModal()` hooks.
2. **`TurnkeyConfigProvider`** (custom, in `src/providers/config/`) — a demo-specific wrapper that makes the `TurnkeyProviderConfig` mutable at runtime, enabling the interactive configuration panel. In a production app you would pass a static config directly to `TurnkeyProvider`.
3. **Page components** (`UserSettings`, `DemoPanel`) — consume the hooks to build the UI.

### Provider Setup

The entry point is `src/app/layout.tsx`. It imports the SDK stylesheet, constructs the config, and wraps the app:

```tsx
import "@turnkey/react-wallet-kit/styles.css";

<TurnkeyConfigProvider
  initialConfig={initialConfig}
  callbacks={{
    onError: (error) => {
      // Handle TurnkeyError by code
      switch (error.code) {
        case TurnkeyErrorCodes.ACCOUNT_ALREADY_EXISTS:
          notify("This social login is already associated with another account.");
          break;
        default:
          notify(error.message);
      }
    },
  }}
>
  {children}
</TurnkeyConfigProvider>
```

Inside `TurnkeyConfigProvider`, the SDK's `TurnkeyProvider` is rendered with the current config:

```tsx
<TurnkeyProvider config={config} callbacks={callbacks}>
  {children}
</TurnkeyProvider>
```

### Configuration (`src/constants.ts`)

The `TurnkeyProviderConfig` object controls everything the SDK does. Here's how each section maps to behavior:

#### API Endpoints

```ts
apiBaseUrl: "https://api.turnkey.com",       // Turnkey API (wallet ops, signing)
authProxyUrl: "https://authproxy.turnkey.com", // Auth Proxy (OTP, OAuth — no backend needed)
authProxyConfigId: "...",                      // Ties to your Dashboard auth config
organizationId: "...",                         // Your parent organization
importIframeUrl: "https://import.turnkey.com", // Secure iframe for wallet import
exportIframeUrl: "https://export.turnkey.com", // Secure iframe for wallet export
```

The **Auth Proxy** is Turnkey's managed service that handles OTP delivery (email/SMS) and OAuth token exchange without requiring you to build a backend. It's configured in the Turnkey Dashboard (allowed origins, session lifetimes, email templates, etc.) and referenced here by its config ID.

The **import/export iframes** are Turnkey-hosted secure contexts used for wallet import and export operations. Private key material never leaves these sandboxed iframes.

#### Authentication Methods

```ts
auth: {
  methods: {
    emailOtpAuthEnabled: true,     // Email one-time password
    smsOtpAuthEnabled: false,      // SMS one-time password
    passkeyAuthEnabled: true,      // WebAuthn (Touch ID, Face ID, Windows Hello)
    walletAuthEnabled: true,       // Sign-in with external wallet (SIWE/SIWS)
    googleOauthEnabled: true,      // Google OAuth
    appleOauthEnabled: false,      // Apple OAuth
    facebookOauthEnabled: false,   // Facebook OAuth
    xOauthEnabled: false,          // X/Twitter OAuth
    discordOauthEnabled: false,    // Discord OAuth
  },
  methodOrder: ["socials", "email", "sms", "passkey", "wallet"],
  autoRefreshSession: true,  // Auto-refresh sessions before expiry
}
```

The `methodOrder` array controls the display order of auth methods in the login modal. `autoRefreshSession` keeps users logged in during active use.

#### Sub-Organization & Wallet Creation on Signup

When a user authenticates for the first time, Turnkey creates a **sub-organization** under your parent org. The `createSuborgParams` config defines what wallets and accounts are provisioned at signup:

```ts
auth: {
  createSuborgParams: {
    emailOtpAuth: createSuborgParams,  // Config for email signups
    smsOtpAuth: createSuborgParams,    // Config for SMS signups
    passkeyAuth: createSuborgParams,   // Config for passkey signups
    walletAuth: createSuborgParams,    // Config for wallet signups
    oauth: createSuborgParams,         // Config for OAuth signups
  },
}
```

Each method references the same `CreateSubOrgParams` in this example:

```ts
const createSuborgParams: CreateSubOrgParams = {
  customWallet: {
    walletName: "Wallet 1",
    walletAccounts: [
      {
        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/60'/0'/0/0",
      },
      {
        addressFormat: "ADDRESS_FORMAT_SOLANA",
        curve: "CURVE_ED25519",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/501'/0'/0/0",
      },
    ],
  },
};
```

This means every new user gets an HD wallet with both an Ethereum account (secp256k1, BIP-44 path `m/44'/60'/0'/0/0`) and a Solana account (ed25519, BIP-44 path `m/44'/501'/0'/0/0`) created automatically.

#### External Wallet Connections (WalletConnect)

```ts
walletConfig: {
  features: {
    auth: true,        // Enable wallet-based authentication
    connecting: true,  // Enable connecting external wallets post-login
  },
  chains: {
    ethereum: { native: true, walletConnectNamespaces: ["eip155:1"] },
    solana: { native: true, walletConnectNamespaces: ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"] },
  },
  walletConnect: {
    projectId: "...",
    appMetadata: { name: "Turnkey Wallet", description: "...", url: "...", icons: [...] },
  },
}
```

#### UI Customization

```ts
ui: {
  darkMode: true,
  borderRadius: 16,
  backgroundBlur: 8,
  renderModalInProvider: true,  // Renders modal inside the provider tree (vs portal)
  colors: {
    light: { primary: "#335bf9", modalBackground: "#f5f7fb" },
    dark:  { primary: "#335bf9", modalBackground: "#0b0b0b" },
  },
}
```

---

### Authentication Flow

The authentication flow begins in `src/app/page.tsx`:

```
1. App mounts → TurnkeyProvider initializes (clientState = Loading)
2. SDK initializes client, checks for existing session → clientState = Ready
3. useEffect fires: if Ready + Unauthenticated → calls handleLogin()
4. handleLogin() opens the SDK's modal with all enabled auth methods
5. User selects a method and completes auth
6. SDK creates sub-org (first time) or authenticates against existing one
7. authState transitions to Authenticated
8. App renders UserSettings + DemoPanel
```

The relevant code:

```tsx
const { handleLogin, clientState, authState } = useTurnkey();

useEffect(() => {
  if (clientState === ClientState.Ready && authState === AuthState.Unauthenticated) {
    handleLogin();
  }
}, [clientState]);
```

`handleLogin()` is the SDK's all-in-one entry point. It renders a modal with the configured auth methods (passkeys, email OTP, OAuth, external wallet) and orchestrates the entire flow — including sub-organization creation, session establishment, and wallet provisioning.

### The `useTurnkey()` Hook

This is the primary API surface. The example uses these methods:

#### State

| Property | Type | Description |
|---|---|---|
| `authState` | `AuthState` | `Authenticated` or `Unauthenticated` |
| `clientState` | `ClientState` | `Loading`, `Ready`, or `Error` |
| `user` | `User` | Current user (email, phone, authenticators, oauthProviders, apiKeys) |
| `wallets` | `Wallet[]` | All wallets (embedded + connected), auto-refreshed on changes |
| `session` | `Session` | Current session (includes `organizationId` for the sub-org) |
| `config` | `TurnkeyProviderConfig` | The active config (used by `UserSettings` to conditionally render auth methods) |

#### Authentication

| Method | Used In | Description |
|---|---|---|
| `handleLogin()` | `page.tsx` | Opens the unified login modal |
| `handleAddEmail()` | `UserSettings` | Links an email to the current user |
| `handleRemoveUserEmail()` | `EmailAuthButton` | Removes the linked email |
| `handleAddPhoneNumber()` | `UserSettings` | Links a phone number |
| `handleRemoveUserPhoneNumber()` | `PhoneAuthButton` | Removes the linked phone |
| `handleAddOauthProvider()` | `SocialButton` | Links an OAuth provider (Google, Apple, etc.) |
| `handleRemoveOauthProvider()` | `SocialButton` | Unlinks an OAuth provider |
| `handleAddPasskey()` | `AuthenticatorButton` | Adds a new passkey authenticator |
| `handleRemovePasskey()` | `AuthenticatorButton` | Removes a passkey authenticator |
| `handleUpdateUserName()` | `UserSettings` | Updates the user's display name |
| `logout()` | `UserSettings` | Ends the session |

#### Wallet Operations

| Method | Used In | Description |
|---|---|---|
| `createWallet()` | `DemoPanel` | Creates a new embedded wallet with Ethereum + Solana accounts |
| `createWalletAccounts()` | `DemoPanel` | Adds accounts to an existing wallet |
| `fetchWallets()` | `DemoPanel` | Manually refreshes the wallet list |
| `handleConnectExternalWallet()` | `DemoPanel` | Opens WalletConnect to link an external wallet |
| `fetchWalletProviders()` | `DemoPanel` | Gets connected wallet provider metadata (icons, names) |
| `handleExportWallet()` | `DemoPanel` | Opens the secure export iframe modal |
| `handleImportWallet()` | `DemoPanel` | Opens the secure import iframe modal |
| `handleOnRamp()` | `DemoPanel` | Opens MoonPay fiat on-ramp (sandbox mode) |
| `deleteSubOrganization()` | `DeleteSubOrgWarning` | Permanently deletes the user's sub-org and all wallets |

#### Signing

| Method | Used In | Description |
|---|---|---|
| `handleSignMessage()` | `DemoPanel` | Signs a message with a selected wallet account, returns `{ r, s, v }` |

### Message Signing & Verification

The signing flow in `DemoPanel` demonstrates end-to-end message signing with client-side verification:

```
1. User selects a wallet account (Ethereum or Solana)
2. Clicks "Sign Message"
3. handleSignMessage({ message, walletAccount, addEthereumPrefix: true })
4. SDK returns { r, s, v } signature components
5. App verifies the signature client-side using chain-specific libraries
6. Result is displayed in a modal via useModal().pushPage()
```

**Ethereum verification** (in `src/utils.ts`) uses [viem](https://viem.sh/):

```ts
// Join r, s, v into a single 65-byte hex signature
const signature = joinRSV(r, s, v);  // Uses @turnkey/encoding for padding

// Verify using viem's verifyMessage
return await publicClient.verifyMessage({ address, message, signature });
```

**Solana verification** uses [TweetNaCl](https://tweetnacl.js.org/):

```ts
// Combine r + s as the 64-byte Ed25519 signature
const signature = new Uint8Array(Buffer.from(r + s, "hex"));

// Verify against the public key (Solana address)
return nacl.sign.detached.verify(messageBytes, signature, pubKey.toBytes());
```

### Wallet Model

The SDK exposes wallets through the `Wallet` type:

```ts
{
  walletId: string;
  walletName: string;
  source: WalletSource;   // "Embedded" (Turnkey-managed) or "Connected" (external)
  accounts: WalletAccount[];
  exported: boolean;       // Whether the wallet has been exported
}
```

Each `WalletAccount` has an `address`, `addressFormat` (`ADDRESS_FORMAT_ETHEREUM` or `ADDRESS_FORMAT_SOLANA`), and `walletAccountId`.

The `DemoPanel` distinguishes between embedded and connected wallets — export/import buttons are only shown for embedded wallets since connected wallets are managed externally.

### The `useModal()` Hook

The SDK provides a stack-based modal system. This example uses it to push custom pages into the SDK's modal:

```tsx
const { pushPage } = useModal();

// Push signature verification result
pushPage({
  key: "Signature verification",
  content: <SignatureVerification verificationPassed={true} signature="0x..." />,
  preventBack: true,
  showTitle: false,
});

// Push delete account warning
pushPage({
  key: "Delete sub-organization",
  content: <DeleteSubOrgWarning />,
  preventBack: true,
  showTitle: false,
});
```

### Auth Method Management

The `UserSettings` component shows how to manage authentication methods post-login. Users must always retain at least one auth method — the `canRemoveAuthMethod` flag is computed by counting all active methods:

```ts
const userAuthMethods =
  (user?.authenticators?.length || 0) +         // Passkeys
  (user?.oauthProviders?.length || 0) +         // OAuth providers
  (user?.apiKeys?.filter(k =>                   // Wallet-auth API keys
    k.apiKeyName.startsWith("wallet-auth")
  ).length || 0) +
  (user?.userEmail ? 1 : 0) +                   // Email
  (user?.userPhoneNumber ? 1 : 0);              // Phone

setCanRemoveAuthMethod(userAuthMethods > 1);
```

Each auth button (`EmailAuthButton`, `PhoneAuthButton`, `SocialButton`, `AuthenticatorButton`) follows the same pattern: render an `AuthToggleButton` that shows "Link" or "Unlink" based on whether the method is already associated with the user.

### Error Handling

The SDK surfaces errors as `TurnkeyError` instances with typed error codes:

```tsx
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";

if (error instanceof TurnkeyError) {
  switch (error.code) {
    case TurnkeyErrorCodes.ACCOUNT_ALREADY_EXISTS:
      // Social login already linked to another account
      break;
    case TurnkeyErrorCodes.USER_CANCELED:
      // User dismissed the modal — no-op
      break;
    default:
      // Display error.message to user
  }
}
```

Global errors are caught via the `callbacks.onError` handler on `TurnkeyProvider`. Action-specific errors (signing, connecting) are caught inline in try/catch blocks.

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              Root layout — SDK styles, TurnkeyConfigProvider, error callbacks
│   └── page.tsx                Main page — auto-login, responsive layout (desktop/mobile tabs)
├── providers/config/
│   ├── ConfigProvider.tsx      Demo wrapper around TurnkeyProvider (mutable config, config panel UI)
│   └── Panel.tsx               Interactive config panel (auth methods, theme, drag-and-drop ordering)
├── components/demo/
│   ├── DemoPanel.tsx           Wallet selector, account list, signing, export/import, on-ramp
│   ├── UserSettings.tsx        Account info, auth method management, logout/delete
│   ├── AuthButtons/
│   │   ├── index.tsx           AuthToggleButton — reusable link/unlink button
│   │   ├── EmailAuthButton.tsx
│   │   ├── PhoneAuthButton.tsx
│   │   ├── SocialButton.tsx
│   │   └── AuthenticatorButton.tsx
│   ├── SignatureVerification.tsx  Displays signing result in the modal
│   ├── DeleteSubOrgWarning.tsx   Confirmation dialog for sub-org deletion
│   └── ConfigViewer.tsx          JSON display of current config
├── constants.ts                TurnkeyProviderConfig + CreateSubOrgParams defaults
├── types.ts                    DemoConfig interface
├── utils.ts                    Signature verification (ETH + SOL), theme derivation, helpers
└── global.css                  Tailwind CSS + custom properties
```

## Key Dependencies

| Package | Purpose |
|---|---|
| `@turnkey/react-wallet-kit` | Core SDK — provider, hooks, modal UI, auth, wallet ops, signing |
| `@turnkey/sdk-types` | Shared types and enums (`TurnkeyErrorCodes`, `OAuthProviders`) |
| `@turnkey/encoding` | Byte encoding utilities (hex ↔ Uint8Array, padding normalization) |
| `viem` | Ethereum signature verification (`verifyMessage`) |
| `@solana/web3.js` + `tweetnacl` | Solana public key parsing + Ed25519 signature verification |
| `@headlessui/react` | Accessible unstyled UI components (Menu, RadioGroup, Tab, Transition) |
| `next` (15.x) | React framework (App Router) |

## Learn More

- [React Wallet Kit — Getting Started](https://docs.turnkey.com/sdks/react/getting-started)
- [Authentication Overview](https://docs.turnkey.com/sdks/react/auth)
- [Using Embedded Wallets](https://docs.turnkey.com/sdks/react/using-embedded-wallets)
- [Signing](https://docs.turnkey.com/sdks/react/signing)
- [EWK Reference](https://docs.turnkey.com/reference/embedded-wallet-kit)
- [Auth Proxy Reference](https://docs.turnkey.com/reference/auth-proxy)
