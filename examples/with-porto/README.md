# Example: `with-porto`

This example shows how to upgrade a Turnkey EOA to a [Porto](https://porto.sh/) wallet and then perform operations with it, **using API keys**.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-porto/
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

1. upgrade your Turnkey EOA to a Porto wallet
2. demonstrate an operation from the upgraded wallet – sends some ETH

Sample output from a successful execution:

```
$ pnpm start

> @turnkey/example-with-porto@0.1.0 start /Users/struong/tkhq-sdk/examples/with-porto
> tsx src/viem.ts

[*] Setup complete, preparing to upgrade EOA to a Porto wallet... { turnkeyEoa: '0x5154D11253AE4a21e03b2eaF7E80A5D3aA451f24' }
[*] Account successfully upgraded!
[*] Make sure your account is funded with Base Sepolia ETH...
[*] Account funded with 0.000094777182925975 Base Sepolia ETH
[*] User operation sent: 0x32c1dbd23cae35dd56ae6dc7ab741988cfb17562e3a9375325c108112e459f7c
[*] See details at https://jiffyscan.xyz/userOpHash/0x32c1dbd23cae35dd56ae6dc7ab741988cfb17562e3a9375325c108112e459f7c?network=base-sepolia
```
