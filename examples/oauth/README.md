# Example: `oauth`

This is a minimal Next.js app showing how to implement **OAuth login (Google)** with Turnkey using the `@turnkey/react-wallet-kit`, wired up to **your own backend** via Next.js Server Actions (see: [Advanced backend authentication](https://docs.turnkey.com/sdks/react/advanced-backend-authentication)).

### What this demo shows

A high-level summary of the user experience and what appears on screen.

After visiting the app, the user can:

- Log in with Google OAuth (via `@react-oauth/google`)
- Authenticate with Turnkey by exchanging the user’s Google credential through your own backend, implemented here using Next.js Server Actions.
- Automatically create or access a Turnkey sub-organization / embedded wallet.

Once logged in, the dashboard is split into two main panels:

- Left side: sign a message and a simple EIP-1559 Ethereum transaction
- Right side: display the sub-organization embedded wallets

## How it works

1. Client creates an ephemeral / session API keypair with `createApiKeyPair()` (securely stored in IndexedDB).
2. The Google button is rendered with a `nonce = sha256(publicKey)`.
3. After Google returns an OIDC token, the client calls your Server Actions to:

- Find (`getSubOrgIds`) or create (`createSubOrganization`) a Turnkey sub-organization with an Ethereum wallet bound to that OIDC identity.
- Create a Turnkey read-write session jwt (`oauthLogin`) bound to the indexedDb keypair (see: [Sessions](https://docs.turnkey.com/authentication/sessions#read-write-sessions)).

4. Use the user session in the dashboard to load the sub-org embedded wallets, sign a message (`signRawPayload`) and sign a transaction (`signTransaction`).

> Why the `nonce = sha256(publicKey)`?
> It cryptographically binds the Google OIDC token to the same keypair, that prevents OIDC tokens from being used against multiple public keys.

## Getting started

### 1/ Cloning the example

Make sure you have `node` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/oauth/
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
- `NEXT_PUBLIC_BASE_URL` (the `NEXT_PUBLIC` prefix makes the env variable accessible to the frontend app)
- `NEXT_PUBLIC_ORGANIZATION_ID`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`(Google OIDC credentials client id: https://developers.google.com/identity/openid-connect/openid-connect)

### 3/ Running the app

```bash
$ pnpm run dev
```

This command will run a NextJS app on port 3000. If you navigate to http://localhost:3000 in your browser, you can follow the prompts to start an oauth activity.
