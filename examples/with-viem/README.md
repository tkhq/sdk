# Example: `with-viem`

This example shows how to construct and sign a transaction using Turnkey's [`@turnkey/viem`](https://www.npmjs.com/package/@turnkey/viem) signer, **using API keys**.

If you want to see a demo with passkeys, head to the example [`with-viem-and-passkeys`](https://github.com/tkhq/demo-viem-passkeys) to see a NextJS app using passkeys.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v16+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-viem/
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
- `BASE_URL`
- `ORGANIZATION_ID`
- `SIGN_WITH`

### 3/ Running the scripts

```bash
$ pnpm start
```

This script will do the following:

1. construct a new transaction
2. sign it with Turnkey
3. broadcast it via Infura

Sample output from a successful execution:

```
$ pnpm start
Fetching Node.js 18.0.0 ...

> @turnkey/example-with-viem@0.0.0 start /Users/rno/tkhq/code/sdk/examples/with-viem
> pnpm -w run build-all && tsx src/index.ts


> @turnkey/oss@ build-all /Users/rno/tkhq/code/sdk
> tsc --build tsconfig.mono.json

Source address
        0xfe81d134AC28b5CAc01E198E5988F449621d960B

Transaction
        https://sepolia.etherscan.io/tx/0x91a388d8a6e506bbaeaf21b2914461a0f6125afb3a84a4cf27bdf5e9eb06ffce
```
