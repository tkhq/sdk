# Example: `wallet-auth-with-backend`

This is a minimal Next.js app showing how to implement [external wallets authentication](https://docs.turnkey.com/sdks/react/using-external-wallets/overview) (e.g. MetaMask, Phantom, etc) with Turnkey using the [@turnkey/react-wallet-kit](https://docs.turnkey.com/sdks/react), wired up to **your own backend** via Next.js Server Actions (see: [Advanced backend authentication](https://docs.turnkey.com/sdks/react/advanced-backend-authentication)).

> Using your own backend is **optional** — it’s an alternative to the Turnkey [Auth Proxy](https://docs.turnkey.com/reference/auth-proxy) for teams that prefer to manage authentication themselves.

### What this demo shows

A high-level summary of the user experience and what appears on screen:

- Use an external wallet to authenticate into a sub-organization. Under the hood the wallet acts as a stamper signing requests sent to Turnkey.
- Automatically create or access a Turnkey sub-organization / embedded wallet tied to the external wallet’s public key.

Once logged in, access a dashboard with two panels:

- **Left:** sign a message and a simple EIP-1559 Ethereum transaction using the **embedded wallet** inside your sub-organization. The external wallet you used to log in acts as a stamper, signing the authentication requests sent to Turnkey.
- **Right:** view all **embedded and connected wallets** from the sub-organization.

## How it works

1. Build and sign a wallet login request **without submitting it to Turnkey** using [buildWalletLoginRequest()](https://github.com/tkhq/sdk/blob/fa54063a394bfef7ead9f64b72a093c5e696a401/packages/core/src/__clients__/core.ts#L797). This function performs the following:

- Initializes the wallet stamper, ensures a valid session public key (generating one if needed), and signs the login intent with the connected wallet.
- For **Ethereum wallets**, the public key cannot be derived from the wallet address alone — it’s extracted from the signature included in the stamped login request.
- For **Solana wallets**, the wallet address itself is the public key, so it’s retrieved directly from the connected wallet.
- Returns both:
  > `publicKey` — the derived or extracted wallet public key.
  > `signedRequest` — the signed login request, used later by your backend to find or create the sub-organization associated with that public key.

2. Find or create a sub-organization for the connected wallet:

- Call your server action `getSuborgsAction({ publicKey })`.
- If no result then call `createSuborgAction({ publicKey, curveType })`.
- curveType is `API_KEY_CURVE_ED25519` for Solana, otherwise `API_KEY_CURVE_SECP256K1`.

3. Send the signed request to Turnkey.

4. Store the returned session JWT using `storeSession()`, allowing the SDK’s built-in session management to automatically handle authentication state and lifecycle management.

5. Redirect to /dashboard.

## Getting started

### 1/ Cloning the example

Make sure you have `node` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/wallet-auth/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID

Once you've gathered these values, add them to a new `.env.local` file. Notice that your API private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_ORGANIZATION_ID`

### 3/ Running the app

```bash
$ pnpm run dev
```

This command will run a NextJS app on port 3000. If you navigate to http://localhost:3000 in your browser, you can follow the prompts to start an oauth activity.
