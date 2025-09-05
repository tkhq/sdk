# Example: `react-components`

This example shows an example app created using our react components from @turnkey/sdk-react. For more information [check out our documentation](https://docs.turnkey.com/features/TODO). #TODO docs for react components and is also hosted [here](TODO) #TODO add hosted URL - e.g demo.turnkey.com

## Getting started

### 1/ Cloning the example

Make sure you have `node` installed locally; we recommend using Node v18+. You will also need NextJS v13+ (for use-server/use-client directives and /app directory structure). Our components leverage use-server to make server side calls using private API keys without requiring developers to setup their own backend for Turnkey authentication

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/react-components/
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

- `TURNKEY_API_PUBLIC_KEY`
- `TURNKEY_API_PRIVATE_KEY`
- `NEXT_PUBLIC_BASE_URL` (the `NEXT_PUBLIC` prefix makes the env variable accessible to the frontend app)
- `NEXT_PUBLIC_ORGANIZATION_ID`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_FACEBOOK_CLIENT_ID`
- `NEXT_PUBLIC_APPLE_CLIENT_ID`
- `NEXT_PUBLIC_IMPORT_IFRAME_URL`
- `NEXT_PUBLIC_EXPORT_IFRAME_URL`
- `NEXT_PUBLIC_OAUTH_REDIRECT_URI`

### 3/ Running the app

```bash
$ pnpm run dev
```

This command will run a NextJS app on port 3000. If you navigate to http://localhost:3000 in your browser, the example app using auth components should be ready to use!

### 4/ Using ngrok for OAuth

To enable OAuth flows like Google, Facebook, or Apple on your local environment, you’ll need to use [ngrok](https://ngrok.com) to expose your localhost server to the internet. This is necessary because OIDC providers require a publicly accessible redirect URI during the authentication process.

#### Steps:

1. **Install ngrok**: Follow the [ngrok installation guide](https://ngrok.com/download) to install ngrok on your machine.
2. **Run ngrok**: Start ngrok and point it to port 3000 (the port your app runs on):

```bash
$ ngrok http 3000
```
