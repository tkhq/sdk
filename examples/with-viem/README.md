# Example: `with-viem`

This example shows how to construct and sign a transaction using Turnkey's [`@turnkey/viem`](https://www.npmjs.com/package/@turnkey/viem) signer, **using API keys**.

If you want to see a demo with passkeys, head to the example [`with-viem-and-passkeys`](https://github.com/tkhq/demo-viem-passkeys) to see a NextJS app using passkeys.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

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
        0xDC608F098255C89B36da905D9132A9Ee3DD266D9

Transaction
        https://sepolia.etherscan.io/tx/0xf21c98e02dc987c1987da06cab7523c0de6cb3a275064c918001907d9adfc11d

Turnkey-powered signature:
        0x83d002f3b5b0de4f4532c402efdc8544a1986c73207e63e6b743900ac1387125012b39c0918fafb9cde4293480f670c007c84c6c63e149cb0c8ca9409a36ca351b

Recovered address:
        0xDC608F098255C89B36da905D9132A9Ee3DD266D9
```

Note: if you have a consensus-related policy resembling the following

```
{
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.count() >= 2"
}
```

then the script will await consensus to be met. Specifically, the script will attempt to poll for activity completion per the `activityPoller` config passed to the `TurnkeyServerSDK`. If consensus still isn't met during this period, then the resulting `Consensus Needed` error will be caught, and the script will prompt the user to indicate when consensus has been met. At that point, the script will continue.
