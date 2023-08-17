# Example: `with-viem-and-passkeys`

This example shows how to create sub-organizations, create private keys, and sign with the [`@turnkey/viem`](../../packages/viem/) signer, using passkeys.

![UI screenshot](./img/ui-screenshot.png)

The flow showcases 3 ways to make requests to Turnkey:

- the initial request to create a new [sub-organization](https://docs.turnkey.com/getting-started/sub-organizations) is authenticated in the NextJS backend with an API signature (using `API_PUBLIC_KEY`/`API_PRIVATE_KEY` from your `.env.local` file)
- the request to create a new ETH address is signed on the frontend with your passkey, but it's passed to the NextJS backend as a signed request (the body, stamp, and url are POSTed). This lets the backend submit this request on your behalf, and poll until the new "create private keys" activity completes. Once the activity completes it returns the new address to the frontend
- the request to sign a message is done 100% client-side via a Turnkey Viem signer (see [@turnkey/viem](../../packages/viem/)): it's signed with your passkey, and submitted from the browser to the Turnkey API directly.

If you want to see a Viem demo with API keys instead of passkeys, head to the example [`with-viem`](../with-viem/).

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v16+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-viem-and-passkeys/
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
- `NEXT_PUBLIC_TURNKEY_API_BASE_URL`
- `ORGANIZATION_ID`

### 3/ Running the app

```bash
$ pnpm run dev
```

This command will start a NextJS app on localhost. If you navigate to http://localhost:3000 in your browser, you can follow the prompts to create a sub organization, create a private key for the newly created sub-organization, and sign a message using your passkey with a Viem custom account!
