# Example: `with-solana-paymaster`

This example shows how to send an SPL token on Solana using Turnkey's paymaster (fee sponsorship).

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-solana-paymaster/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- A Solana wallet address

Once you've gathered these values, add them to a new `.env.local` file. Notice that your API private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `ORGANIZATION_ID`
- `SIGN_WITH` — the Solana address of the wallet to send from
- `SOLANA_NETWORK` — `mainnet` or `devnet` (defaults to `mainnet`)

### 3/ Running the script

```bash
pnpm send-spl
```

You will be prompted for a recipient address and USDC amount (default 0.1). The script checks the sender's SPL token balance, asks for confirmation, then submits the transfer. It polls status and prints a Solana Explorer link when the transaction is confirmed.

## What it does

- Derives the sender's and recipient's Associated Token Accounts (ATAs) for USDC
- Optionally creates the recipient's ATA if it doesn't exist yet (rent covered by the paymaster)
- Builds a V0 `VersionedTransaction` locally using `@solana/web3.js`
- Requests Turnkey fee sponsorship by setting `sponsor: true` in `solSendTransaction`
- Polls transaction status until included and prints the transaction signature
