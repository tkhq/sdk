# Example: `wallet-auth-without-backend`

This is a minimal Next.js app showing how to implement [external wallets authentication](https://docs.turnkey.com/sdks/react/using-external-wallets/overview) (e.g. MetaMask, Phantom, etc) with Turnkey using the [@turnkey/react-wallet-kit](https://docs.turnkey.com/sdks/react) and [Auth Proxy](https://docs.turnkey.com/reference/auth-proxy).

> No backend required. This example uses Turnkey’s Auth Proxy behind the scenes, so your frontend can securely perform sign-up / login without hosting your own authentication server.

### What this demo shows

A high-level summary of the user experience and what appears on screen:

- Use an external wallet to authenticate into a sub-organization. Under the hood the wallet acts as a stamper signing requests sent to Turnkey.
- Automatically create or access a Turnkey sub-organization / embedded wallet tied to the external wallet’s public key.

Once logged in, access a dashboard with two panels:

- **Left:** sign a message and a simple EIP-1559 Ethereum transaction using the **embedded wallet** inside your sub-organization. The external wallet you used to log in acts as a stamper, signing the authentication requests sent to Turnkey.
- **Right:** view all **embedded and connected wallets** from the sub-organization.

## How it works

1. Wrap your app with the [TurnkeyProvider](https://docs.turnkey.com/sdks/react/getting-started#provider) component. Configure it for this example by:

- [Sub-organization customization](https://docs.turnkey.com/sdks/react/sub-organization-customization#customization) - Add an Ethereum embedded wallet at creation time.
- **Auth methods** - Disable everything except wallet authentication (`walletAuthEnabled`). You can toggle methods in the [Dashboard](https://app.turnkey.com/dashboard/walletKit) or in your `app/providers.tsx` wrapper (which takes precedence over Dashboard settings).
- [Chains](https://docs.turnkey.com/sdks/react/using-external-wallets/authentication#setting-up-wallet-authentication) Allow Ethereum and Solana for external wallet auth.

2. Trigger wallet authentication with `handleLogin()`. Call `handleLogin()` from `useTurnkey()`. The SDK opens a modal with the enabled auth methods and supported wallet providers.

- The flow is **idempotent:** if a user already exists, they log in; otherwise a sub-organization is created and the wallet’s public key is registered as an authenticator.

3. Session is stored and used automatically. After login, the SDK persists a Turnkey session and exposes it via useTurnkey(). The dashboard can now:

- Sign messages and sign EIP-1559 transactions using the embedded wallet in the sub-org (the external wallet is only used to authenticate / stamp login).
- List wallets (embedded + any connected wallets) through the wallets array.

## Getting started

### 1/ Cloning the example

Make sure you have `node` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/wallet-auth/without-backend
```

### 2/ Setting up Turnkey

- Set up your [Turnkey organization and account](https://docs.turnkey.com/getting-started/quickstart#create-an-account) and write down the parent organization id.
- Enable [Auth Proxy](https://app.turnkey.com/dashboard/walletKit) from your Turnkey dashboard, choose the user auth methods and write down the Auth Proxy Config ID.

Once you've gathered these values, add them to a new `.env.local` file. Notice that your API private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_ORGANIZATION_ID`
- `NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID`

### 3/ Running the app

```bash
$ pnpm run dev
```

This command will run a NextJS app on port 3000. If you navigate to http://localhost:3000 in your browser, you can follow the prompts to start an oauth activity.
