# Example: `with-x`

This example shows a complete OAuth 2.0 login flow with X (Twitter) using [`@turnkey/react-wallet-kit`](https://www.npmjs.com/package/@turnkey/react-wallet-kit) and a custom Next.js backend. It contains:

- A login page that initiates the X OAuth 2.0 flow
- A backend route (`/auth/x`) that redirects to X's authorization endpoint
- A backend route (`/auth/turnkey/x`) that exchanges the auth code for a Turnkey session via `oauth2Authenticate`
- A redirect page (`/auth/x/redirect`) that handles the OAuth callback and stores the session
- A dashboard page that displays the authenticated user's ID and Solana wallet address

For more information on OAuth, [check out our documentation](https://docs.turnkey.com/authentication/social-logins).

## Getting started

### 1/ Cloning the example

Make sure you have `node` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-x/
```

### 2/ Setting up Turnkey

If you don't have a Turnkey account yet, follow the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide to create an organization.

You'll also need a **Turnkey API keypair** for the backend to authenticate with the Turnkey API. Create one in the Turnkey dashboard and save the public and private keys — they will be used for `API_PUBLIC_KEY` and `API_PRIVATE_KEY` in your `.env.local`.

### 3/ Setting up X

Navigate to the [X developer console](https://console.x.com/) and create an app. Then:

1. In **User authentication settings** for your app, click **Set up**. You'll be asked to fill in:
   - **App permissions**: select **Read**
   - **Type of App**: select **Web App**
   - **App info**: add a **Callback URI / Redirect URL** and a **Website URL**

   For the callback URI use:

   ```
   http://127.0.0.1:3456/auth/x/redirect
   ```

   > Use `127.0.0.1` and NOT `localhost`. The port must match the `PORT` value in your `.env.local`.

   Save changes. These settings can be updated later via the app's settings menu.

2. After setup completes, your **Client ID** and **Client Secret** are shown once — copy them immediately. The secret cannot be viewed again (only regenerated). Your Client ID can always be found later under **OAuth 2.0 Keys** in the app view.

### 4/ Configuring your environment

Copy the example env file:

```bash
$ cp .env.local.example .env.local
```

Open `.env.local` and fill in all values:

- `NEXT_PUBLIC_BASE_URL` — Turnkey API base URL (`https://api.turnkey.com`)
- `NEXT_PUBLIC_ORGANIZATION_ID` — your Turnkey organization ID
- `API_PUBLIC_KEY` — your Turnkey API public key
- `API_PRIVATE_KEY` — your Turnkey API private key
- `X_CLIENT_ID` — your X OAuth 2.0 Client ID
- `X_REDIRECT_URI` — the callback URI you registered on X (`http://127.0.0.1:3456/auth/x/redirect`)
- `PORT` — port for the dev server (`3456`)

### 5/ Uploading X credentials to Turnkey

The backend uses Turnkey's `oauth2Authenticate` to exchange X auth codes for OIDC tokens. To do this, Turnkey needs your X Client Secret uploaded and encrypted. Run the credential-upload script:

```bash
pnpm run credential-upload -- <client_secret>
```

On success it prints an **OAuth 2.0 Credential ID**. Add that value to `.env.local`:

- `OAUTH2_CREDENTIAL_ID` — the credential ID returned by the script

### 6/ Running the app

```bash
pnpm run dev
```

Navigate to http://127.0.0.1:3456 in your browser and follow the prompts to sign in with X.
