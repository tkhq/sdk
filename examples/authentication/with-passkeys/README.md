# Example: `with-passkeys`

This example shows how to implement [passkey authentication](https://docs.turnkey.com/features/authentication/passkeys/introduction) with Turnkey using the [@turnkey/react-wallet-kit](https://docs.turnkey.com/solutions/embedded-wallets/integration-guide/react).

It contains one implementation:

- **with-backend** - Demonstrates passkey sign-up and login through **your own backend**, with a post-auth dashboard for signing messages and sending transactions via Turnkey's [transaction management](https://docs.turnkey.com/features/transaction-management).

---

## Auth Proxy vs. Custom Backend

There are two ways to integrate passkey auth with Turnkey:

### Without a backend — Auth Proxy

Turnkey's managed [Auth Proxy](https://docs.turnkey.com/features/authentication/auth-proxy) handles sub-organization creation and session management for you. Your frontend calls the Auth Proxy directly — no backend code required.

**This flow is covered by the [`react-wallet-kit` demo](https://wallets.turnkey.com/) ([source](https://github.com/tkhq/sdk/tree/main/examples/demos/with-react-wallet-kit)).** To enable passkeys via Auth Proxy, configure `TurnkeyProvider` like this:

```tsx
<TurnkeyProvider
  config={{
    organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    // Auth Proxy handles sub-org creation — no backend needed
    authProxyUrl: "https://authproxy.turnkey.com",
    authProxyConfigId: process.env.NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID!,
    auth: {
      createSuborgParams: {
        // Wallet accounts to create alongside the passkey sub-org
        passkeyAuth: {
          userName: "A passkey user",
          customWallet: {
            walletName: "Default Wallet",
            walletAccounts: [
              {
                curve: "CURVE_SECP256K1",
                pathFormat: "PATH_FORMAT_BIP32",
                path: "m/44'/60'/0'/0/0",
                addressFormat: "ADDRESS_FORMAT_ETHEREUM",
              },
            ],
          },
        },
      },
    },
    ui: {
      authModal: {
        methods: {
          passkeyAuthEnabled: true,
          emailOtpAuthEnabled: false,
          smsOtpAuthEnabled: false,
          walletAuthEnabled: false,
          googleOauthEnabled: false,
          appleOauthEnabled: false,
        },
      },
    },
  }}
>
  <App />
</TurnkeyProvider>
```

The Auth Proxy creates the sub-org and registers the passkey as the root authenticator. Your frontend calls `handleLogin()` from `useTurnkey()` — no backend code required. See the [react-wallet-kit auth docs](https://docs.turnkey.com/solutions/embedded-wallets/integration-guide/react/auth) for full configuration details.

### With a backend — Custom server

You host your own backend that creates sub-organizations using your Turnkey API key. This gives you full control over:

- Storing and associating user data with Turnkey sub-organizations
- Adding custom validation, rate limiting, and logging
- Enabling multi-party signing patterns where your server co-signs (e.g. 2/2, 2/3, etc.)

**This is what `with-backend` demonstrates.**

---

## with-backend

### How it works

The UI has a single **"Continue with passkey"** button. The flow branches based on whether the email already has a sub-organization.

> **Note on the email field:** Collecting an email before the passkey tap is a design choice, not a requirement. You could skip it entirely and go straight to the WebAuthn assertion — Turnkey can look up a sub-org by passkey credential directly (`filterType: "CREDENTIAL_ID"`). The email approach is used here because it lets the app branch between sign-up and login before touching the authenticator, gives the OS credential picker a meaningful label, and doubles as a `filterType: "EMAIL"` lookup key. Feel free to replace it with a username or any other identifier — or drop it altogether if your UX doesn't need it.

**Sign up (new user — 1 passkey tap)**

A naive implementation would require two passkey taps: one to create the credential and a second to authenticate with it. This example avoids that by bootstrapping the session with a short-lived API key — the same pattern the SDK uses internally when Auth Proxy handles sign-up (see [`signUpWithPasskey` in core.ts](https://github.com/tkhq/sdk/blob/0b2847a3f10678ca1bf7347ce10186f2fabe7ed8/packages/core/src/__clients__/core.ts#L653)):

1. User enters their email and clicks **Continue with passkey**.
2. The client calls your backend (`getSuborgsByEmailAction`) — no sub-org found, so this is a new user.
3. The client generates a temporary P256 keypair via `createApiKeyPair()` — private half stored in IndexedDB, never leaves the device.
4. **One passkey tap** — `createPasskey()` produces an `encodedChallenge` and `attestation`. The email is used as the passkey name so the OS picker shows a meaningful label.
5. The client calls your backend (`createSuborgAction`) with the email, attestation, and temp public key.
6. Your backend calls `createSubOrganization` — registering the passkey as root authenticator and the temp API key with a 60-second expiry.
7. Back on the client, `overrideApiKeyStamper({ temporaryPublicKey })` switches the stamper to use the temp key for the next request.
8. The client generates a long-lived session keypair and calls `httpClient.stampLogin({ publicKey: sessionPublicKey, organizationId })` — stamped by the temp key. Turnkey registers the session keypair and returns a session JWT.
9. `storeSession()` persists the session and updates auth state. `deleteApiKeyPair()` removes the temp key from local storage — it also expires server-side within 60 seconds regardless.

**Log in (returning user — 1 passkey tap)**

1. User enters their email and clicks **Continue with passkey**.
2. The client calls your backend (`getSuborgsByEmailAction`) — sub-org found, so this is a returning user.
3. `loginWithPasskey()` triggers a WebAuthn assertion against the passkey already on their device.
4. Turnkey verifies the assertion and issues a new session.

Your backend is only involved in **sub-org creation (step 6 of sign-up)** — it never participates in login or signing. All requests are stamped client-side by the user's authenticated session.

### Getting started

#### 1/ Clone the repo

```bash
git clone https://github.com/tkhq/sdk
cd sdk/
corepack enable  # Install `pnpm`
pnpm install -r  # Install dependencies
pnpm run build-all  # Compile source code
cd examples/authentication/with-passkeys/with-backend/
```

#### 2/ Set up environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_ORGANIZATION_ID=   # Your Turnkey parent org ID
BASE_URL=https://api.turnkey.com         # Turnkey API base URL (server-only)
API_PUBLIC_KEY=                # API key public key (for your backend)
API_PRIVATE_KEY=               # API key private key (for your backend)
```

#### 3/ Run

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000).
