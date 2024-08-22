# Example: `with-bitcoin`

This example shows how to construct, sign, and broadcast a Bitcoin transaction using Turnkey.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v16+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-bitcoin/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- A Turnkey wallet account (address), private key address, or a private key ID. For Bitcoin addresses, you should create one with the address format `COMPRESSED`.

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `SIGN_WITH_COMPRESSED` -- a Turnkey wallet account address, private key address, or private key ID. If you leave this blank, we'll create a wallet for you.

### 3/ Running the scripts

Note: there are multiple scripts included. See `package.json` for all of them. The following is the default:

```bash
$ pnpm start
```

This script will do the following:

1. Create a new BTC wallet (if necessary)
2. Prompt for a transaction amount and destination
3. Do some UTXO math to perform coin selection
4. Broadcast the transaction

For the sake of example, we utilize three different, prominent Bitcoin API providers: Blockstream, Mempool, and BlockCypher.

### Other

Remaining TODOs:

- Remove usage of ECPair in favor of BIP32 libraries
