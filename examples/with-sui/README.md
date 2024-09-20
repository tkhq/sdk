# Example: `with-sui`

This is a simple example that walks through the following:

- Construction of a sui transaction sending the funds out on mainnet

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
- `SUI_ADDRESS`
- `SUI_PUBLIC_KEY`

### 3/ Running the script

Note that this example is currently set up with sui mainnet. You will need a balance to run this example

```bash
$ pnpm start
```

You should see output similar to the following:

```
? Recipient address: (<recipient_sui_address>)

Sending 1000 MIST (0.000001 SUI) to <recipient_sui_address>

Transaction Hash: <sui_transaction_hash>
```
