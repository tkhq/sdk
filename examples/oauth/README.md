# Example: `oauth`

This is a minimal Next.js app showing how to implement **OAuth login (Google)** with Turnkey using the `@turnkey/react-wallet-kit`, wired up to **your own backend** via Next.js Server Actions (see: [Advanced backend authentication](https://docs.turnkey.com/sdks/react/advanced-backend-authentication)).

### What this demo shows

After visiting the app, the user can:

- Log in with Google OAuth (via `@react-oauth/google`)
- Authenticate with Turnkey by exchanging the Google credential through your own backend, implemented here using Next.js Server Actions.
- Automatically create or access a Turnkey sub-organization with an embedded wallet that holds both an Ethereum and a Solana account.

Once logged in, the dashboard is split into two main panels:

- **Left side — actions:**
  - **Sign Message** — sign an arbitrary message with any EVM or Solana account (`signRawPayload`). Automatically selects `HASH_FUNCTION_SHA256` for secp256k1 (EVM) keys and `HASH_FUNCTION_NOT_APPLICABLE` for ed25519 (Solana) keys.
  - **Send ETH** — submit a Gas Station–sponsored Ethereum transfer on Sepolia or Mainnet via `ethSendTransaction`, then poll for the tx hash with `pollTransactionStatus`. See [Transaction Management](https://docs.turnkey.com/concepts/transaction-management).
  - **Send SOL** — submit a Gas Station–sponsored Solana transfer on Devnet or Mainnet via `solSendTransaction`, then poll for the transaction signature with `pollTransactionStatus`. See [Transaction Management](https://docs.turnkey.com/concepts/transaction-management).
- **Right side** — displays the raw embedded wallet data and the sub-organization ID.

## How it works

1. Client creates an ephemeral / session API keypair with `createApiKeyPair()` (securely stored in IndexedDB).
2. The Google button is rendered with a `nonce = sha256(publicKey)`.
3. After Google returns an OIDC token, the client calls your Server Actions to:

- Find (`getSubOrgIds`) or create (`createSubOrganization`) a Turnkey sub-organization with an embedded wallet containing both Ethereum and Solana accounts bound to that OIDC identity.
- Create a Turnkey read-write session JWT (`oauthLogin`) bound to the IndexedDB keypair (see: [Sessions](https://docs.turnkey.com/authentication/sessions#read-write-sessions)).

4. On the dashboard, the session is used to:
   - Sign messages with `signRawPayload` using the selected EVM or Solana account.
   - Send Gas Station–sponsored transactions with `ethSendTransaction` / `solSendTransaction`, polling for completion via `pollTransactionStatus`.

> Why the `nonce = sha256(publicKey)`?
> It cryptographically binds the Google OIDC token to the same keypair, preventing OIDC tokens from being replayed against a different public key.

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
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Google OIDC credentials client id: https://developers.google.com/identity/openid-connect/openid-connect)

### 3/ Running the app

```bash
$ pnpm run dev
```

This command will run a Next.js app on port 3000. If you navigate to http://localhost:3000 in your browser, you can follow the prompts to start an OAuth activity.
