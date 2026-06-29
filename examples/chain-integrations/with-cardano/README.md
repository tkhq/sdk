# Example: `with-cardano`

This example demonstrates how to derive a Cardano address, then build, sign, and submit a Cardano transaction with Turnkey. Turnkey holds an Ed25519 key pair and signs the transaction body hash via `signRawPayload`; address derivation, fee calculation, and submission are handled by [MeshJS](https://meshjs.dev/).

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using `Node` version `>= 18`.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/chain-integrations/with-cardano/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- An Ed25519 account (`ADDRESS_FORMAT_COMPRESSED` with `CURVE_ED25519`), whose public key you'll use for both address derivation and signing

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

Copy the template env file to a new file named `.env.local`:

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `ORGANIZATION_ID`
- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `CARDANO_PUBLIC_KEY` — your Ed25519 account's public key (hex); doubles as `signWith`
- `NETWORK` — `preprod` (default), `preview`, or `mainnet`

### 3/ Funding the address

The example sends 1 ADA back to your own derived address, so the account needs at least one UTxO. On running, it prints your Cardano address; fund it from a [testnet faucet](https://docs.cardano.org/cardano-testnets/tools/faucet) (for `preprod`/`preview`) before submitting.

### 4/ Running the script

```bash
$ pnpm start
```

The script will:

1. Derive your enterprise address client-side (Blake2b-224 of the public key).
2. Fetch UTxOs and build an unsigned transaction (1 ADA back to yourself).
3. Sign the transaction body hash with Turnkey using Ed25519.
4. Attach the vkey witness and submit the signed transaction via Koios.
