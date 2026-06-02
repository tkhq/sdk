# Example: `otp-auth-without-backend`

This is a minimal Next.js app showing how to implement [email otp authentication](https://docs.turnkey.com/authentication/email) with Turnkey using the [@turnkey/react-wallet-kit](https://docs.turnkey.com/sdks/react) and [Auth Proxy](https://docs.turnkey.com/reference/auth-proxy).

> No backend required. This example uses Turnkey’s Auth Proxy behind the scenes, so your frontend can securely perform sign-up / login without hosting your own authentication server.

### What this demo shows

A high-level summary of the user experience and what appears on screen:

- Authenticate with email OTP into a sub-organization.
- Automatically create or access a Turnkey sub-organization / embedded wallet tied to the user's email address.

Once logged in, access a dashboard with two panels:

**Left:** sign messages and simple demo transactions for both Ethereum (Sepolia testnet) and Solana (Devnet) using the **selected** embedded wallet account. Broadcasting uses a standard JSON-RPC client and returns the resulting transaction hash or signature.

> Broadcasting requires a rpcUrl, you can configure these URLs using `NEXT_PUBLIC_RPC_ETH` and `NEXT_PUBLIC_RPC_SOL`.
> Both Ethereum and Solana demo testnet transactions are send-to-self transfers with zero value, purely for demonstration purposes.

**Right:** view all the sub-organization embedded and connected wallets.

## How it works

1. **Initialize the Turnkey SDK**
   Wrap your app with the [TurnkeyProvider](https://docs.turnkey.com/sdks/react/getting-started#provider) component. Configure it for this example by:

- [Sub-organization customization](https://docs.turnkey.com/sdks/react/sub-organization-customization#customization) - Add one Ethereum and one Solana embedded wallet at creation time.
- **Auth methods** - Disable everything except **Email OTP** (`emailOtpAuthEnabled`). You can toggle methods in the [Dashboard](https://app.turnkey.com/dashboard/walletKit) or in your `app/providers.tsx` wrapper (which takes precedence over Dashboard settings).

2. **Trigger the OTP login flow**
   Call `handleLogin()` from `useTurnkey()` to start authentication.
   The SDK opens a modal powered by Turnkey’s hosted **Auth Proxy**, which handles all the steps internally:

- `initOtp` — Sends the one-time code to the user’s email.
- `verifyOtp` — Verifies the code entered by the user.
- `otpLogin` — Adds the client-side API `publicKey` (generated and stored securely in `indexedDb`) into the user’s sub-organization and issues a new `session JWT`.

3. **Automatic sub-organization management**
   The Auth Proxy automatically finds or creates a sub-organization for the user’s email address.
   Each sub-organization includes a Turnkey wallet with one **Ethereum** and one **Solana** embedded account by default.

4. **Session keypair management**
   The SDK generates a fresh keypair in the browser for each login attempt.
   Once authenticated, the public key becomes the session key registered under the sub-organization, and the SDK stores the session keypair securely in indexedDb.

5. **Session persistence**
   The SDK automatically stores and manages the returned session JWT, handling refresh and expiry for you.
   You can access the authenticated state and wallets directly via useTurnkey().

> **Note:** The session JWT is a signed piece of metadata issued by Turnkey that references the client-side API keypair stored in indexedDb. It’s useful for server-side verification or associating user metadata, but cannot be used to authenticate or stamp API requests.
> Only the client-stored session keypair can create valid x-stamp signatures for Turnkey API calls — the JWT alone is not sufficient outside the client context.

6. **Post-login dashboard**
   After login, redirect the user to `/dashboard`.
   The dashboard can:
   - Sign messages and transactions on Solana (Devnet) or Ethereum (Sepolia testnet) using the selected wallet account.
   - Display wallets and accounts through the wallets array exposed by useTurnkey().

## Getting started

### 1/ Cloning the example

Make sure you have `node` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/otp-auth/without-backend
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
- `NEXT_PUBLIC_AUTH_PROXY_BASE_URL`
- `NEXT_PUBLIC_RPC_SOL`
- `NEXT_PUBLIC_RPC_ETH`

### 3/ Running the app

```bash
$ pnpm run dev
```

This command will run a NextJS app on port 3000. If you navigate to http://localhost:3000 in your browser, you can follow the prompts to start an oauth activity.
