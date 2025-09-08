# Example: `with-doge`

This script builds, signs, broadcasts, and confirms a legacy Dogecoin P2PKH transaction on mainnet:

- Builds a raw P2PKH tx using bitcoinjs-lib (Dogecoin params).
- Fetches the available UTXOs (auto-fetch from BlockCypher or use your preseeded list).
- Signs each input with a Turnkey signer (NO_OP over preimage digest) and enforces low-S ECDSA.
- Broadcasts via BlockCypher.
- Polls BlockCypher until the tx has ≥ 1 confirmation.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-doge/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- A Turnkey wallet

Create a Turnkey new wallet account on Dogecoin mainnet. Make sure that this address is funded with some DOGE UTXOs.

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `SIGNER_ADDRESS`: Turnkey wallet Doge address (mainnet)
- `SIGNER_ADDRESS_PUBKEY`: Turnkey wallet address public key
- `DEST_ADDRESS`: Doge detination address on mainnet

### 3/ Running the scripts

```bash
$ pnpm start
```
