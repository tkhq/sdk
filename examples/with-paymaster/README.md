# Example: `with-paymaster`

This example shows how to send an erc-20 token on evm networks using Turnkey's paymaster (gas sponsorship).

See these for more paymaster examples:

- [`eth-usdc-swap`](../eth-usdc-swap)
- [`sweeper`](../sweeper)

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-paymaster/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- A (crypto) private key ID

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `ORGANIZATION_ID`
- `SIGN_WITH`
- `RECIPIENT`
- `AMOUNT_USDC`

### 3/ Running the scripts

```bash
pnpm send-erc20
```

You will see the sender, recipient, amount, and whether gas is sponsored. Confirm to submit the transfer on the Base network. The script polls status and prints a BaseScan link when mined.

## What it does

- Builds a USDC `transfer` call on Base (`eip155:8453`)
- Checks the sender's USDC balance
- Requests Turnkey sponsorship by setting `sponsor: true` and `gasStationNonce`
- Polls transaction status until included and prints the hash
