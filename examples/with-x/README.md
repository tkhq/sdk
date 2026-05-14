# Example: `with-x`

This example shows a complete OAuth 2.0 login flow with X (Twitter) using [`@turnkey/react-wallet-kit`](https://www.npmjs.com/package/@turnkey/react-wallet-kit). It contains a Next.js app with:

- A login page that initiates the X OAuth 2.0 flow
- A dashboard page that displays the authenticated user's ID and Solana wallet address

Authentication and session management are handled entirely by `@turnkey/react-wallet-kit` via the Turnkey auth proxy — no custom server routes required. For more information on OAuth, [check out our documentation](https://docs.turnkey.com/authentication/social-logins).

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

You'll also need an **auth proxy config** — create one in the Turnkey dashboard under [**Auth Proxy**](https://docs.turnkey.com/reference/auth-proxy#auth-proxy). The auth proxy handles the OAuth token exchange server-side so no API keys are needed in the app.

Once you have your organization ID and auth proxy config ID, copy the example env file:

```bash
$ cp .env.local.example .env.local
```

### 3/ Setting up X

Navigate to the [X developer console](https://console.x.com/) and create an app. Then:

1. In **User authentication settings** for your app, click **Set up**. You'll be asked to fill in:
   - **App permissions**: select **Read**
   - **Type of App**: select **Web App**
   - **App info**: add a **Callback URI / Redirect URL** and a **Website URL**

   For the callback URI use:

```
http://127.0.0.1:3456
```

> Use `127.0.0.1` and NOT `localhost`. The port must match the `PORT` value in your `.env.local`.

   Save changes. These settings can be updated later via the app's settings menu.

2. After setup completes, your **Client ID** and **Client Secret** are shown once — copy them immediately. The secret cannot be viewed again (only regenerated). Your Client ID can always be found later under **OAuth 2.0 Keys** in the app view.
3. In the Turnkey dashboard, open your auth proxy config (**Wallet Kit** tab in the side nav):
   - Scroll down to **OAuth** and make sure it is enabled
   - Under **SDK Configuration > Social Logins**, toggle on **X**
   - If you haven't added your X credentials yet, go to **OAuth 2.0** in the side nav and click **Add Provider**. Select **X** from the provider dropdown, enter your **Client ID** and **Client Secret**, then click **Encrypt & Upload**
   - Go back to **Authentication** in the side nav, scroll to **Social Logins**, click **Select** next to the Client ID field under **Twitter (X)**, and choose your Client ID
   - Scroll to the bottom and click **Save Settings**

### 4/ Configuring your environment

Open `.env.local` and fill in all values:

- `NEXT_PUBLIC_ORGANIZATION_ID` — your Turnkey organization ID
- `NEXT_PUBLIC_AUTH_PROXY_ID` — your auth proxy config ID from the Turnkey dashboard
- `NEXT_PUBLIC_X_CLIENT_ID` — your X OAuth 2.0 Client ID
- `NEXT_PUBLIC_OAUTH_REDIRECT_URI` — the callback URI you registered on X (e.g. `http://127.0.0.1:3456`)

### 5/ Running the app

```bash
pnpm run dev
```

Navigate to http://127.0.0.1:3456 in your browser and follow the prompts to sign in with X.
