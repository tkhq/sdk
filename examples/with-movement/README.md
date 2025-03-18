# Example: `with-movement`

This is a simple example that walks through the following:

- Construction of an movement transaction sending the funds out on mainnet

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-movement/
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
- `MOVEMENT_ADDRESS` - Use ADDRESS_FORMAT_APTOS to generate this
- `MOVEMENT_PUBLIC_KEY` - The compressed ED25519 public key with the same path used to generate the movement address

### 3/ Running the script

Note that this example is currently set up with movement bardock. You will need a balance to run this example. The faucet to retrieve testnet coins is here: https://faucet.movementnetwork.xyz/?network=bardock

```bash
$ pnpm start
```

You should see output similar to the following:

```
? Recipient address: (<recipient_movement_address>)

Sending 100 Octas (0.000001 MOVE) to <recipient_movement_address>

Transaction Hash: <movement_transaction_hash>
```
