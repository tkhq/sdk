# Example: `with-sui`

🚧🚧🚧 WIP 🚧🚧🚧

This example walks you through creating a new wallet on Turnkey and deriving a Sui address.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-sui/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`

You can specify an existing Turnkey Sui address if you have one already:

```
SUI_COMPRESSED_PUBLIC_KEY=<your Turnkey Sui Public Key>
```

Note that this is optional: the script gives you a fresh one if you don't specify one in your `.env.local` file

### 3/ Running the script

```bash
$ pnpm start
```
