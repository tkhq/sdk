# Example: `with-federated-passkeys`

This example shows how to create a sub organization and facilitate creating a private key for the user's sub organization with Turnkey.

## Getting started

### 1/ Cloning the example

Make sure you have `node` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-federated-passkeys/
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
- `NEXT_PUBLIC_ORGANIZATION_ID` (the parent organization, under which end-user sub-organizations will be created)
- `NEXT_PUBLIC_BASE_URL` (the `NEXT_PUBLIC` prefix makes the env variable accessible to the frontend app)
- `NEXT_PUBLIC_IFRAME_URL` (iframe URL; not required for this example)
- `NEXT_PUBLIC_RPID` should be `localhost` unless you're accessing this demo through your own domain
- `NEXT_PUBLIC_SERVER_SIGN_URL` (backend through which API requests should be proxied, if necessary)

### 3/ Running the app

```bash
$ pnpm run dev
```

This command will run a NextJS app on port 3000. If you navigate to http://localhost:3000 in your browser, you can follow the prompts to create a sub-organization and private key for the newly created sub-organization.

### Testing passkey prompts on real mobile devices

The easiest way to test this demo on mobile is through ngrok:

- Install by following the instruction here: https://dashboard.ngrok.com/get-started/setup
- Open a new tunnel to port 3000: `ngrok http 3000`
- Update `NEXT_PUBLIC_RPID` to the ngrok domain (e.g. `372b-68-203-12-187.ngrok-free.app`)
- Now visit the ngrok URL on your mobile device
