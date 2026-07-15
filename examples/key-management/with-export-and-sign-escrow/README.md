# Turnkey Client-Side Signing Escrow Key Injection Example

An example of the Turnkey `export-and-sign` injected embedded key flow for
Solana and Ethereum wallet accounts.

The application demonstrates how to:

- Create Solana and Ethereum wallets with Turnkey
- Export their wallet accounts to an escrow P-256 key
- Inject the escrow key and encrypted account bundles into the
  `export-and-sign` iframe
- Sign and verify Solana and EIP-191 Ethereum messages
- Sign and recover replay-protected EIP-1559 transactions

The sample Ethereum transaction is a zero-value, nonce-zero self-transfer on
chain ID `1`. It is generated only to demonstrate local signing and signature
recovery; the application does not broadcast it.

The `Hello Turnkey!` message is also for signature verification only. Production
authorization messages should bind the signature to its domain and purpose and
include a nonce and expiration.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/key-management/with-export-and-sign-escrow/
```

## 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- An organization ID
- An auth proxy config ID

Once you've gathered these values, add them to a new `.env.local` file.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `NEXT_PUBLIC_ORGANIZATION_ID`
- `NEXT_PUBLIC_AUTH_PROXY_ID`

### 3/ Running the example

First, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

After logging in:

1. Create a Solana wallet, an Ethereum wallet, or both.
2. Create and select an export-and-sign escrow key.
3. Export the wallet accounts to that escrow key.
4. Inject the escrow key and encrypted bundles into the iframe.
5. Sign messages with all exported accounts or sign the sample transaction
   with the exported Ethereum accounts.

The example logs signatures and verification results to the browser console.

Ethereum export bundles are injected with `KeyFormat.Hexadecimal` and the exact
wallet account address. Ethereum messages use `MessageType.Ethereum` (EIP-191),
and transactions use `TransactionType.Ethereum` with an explicit chain ID.
