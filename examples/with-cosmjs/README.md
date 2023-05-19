# Example: `with-cosmjs`

This example shows how to sign and broadcast a Cosmos transaction using [`CosmJS`](https://github.com/cosmos/cosmjs) with Turnkey.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v16+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-cosmjs/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://turnkey.readme.io/docs/quickstart) guide, you should have:

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
- `PRIVATE_KEY_ID` -- if you leave it blank, we'll create one for you via calling the Turnkey API

### 3/ Running the script

```bash
$ pnpm start
```

The script signs your transaction via Turnkey and broadcasts on testnet. If the script exits because your account isn't funded, you can request funds via the [Cosmos Hub Discord](https://discord.com/invite/cosmosnetwork).

Visit the explorer links to view your transaction; you have successfully sent your first transaction with Turnkey!

```
Compressed public key:
	03be8c88bc5e77aaa9a65ba29f38e892e68d736778fce1bf462d27bfaa3beefc93

Wallet address:
	cosmos1kaefh2tuh7syp8x0zy9a3wspnhyn50rulsq5fy

Wallet on explorer:
	https://explorer.theta-testnet.polypore.xyz/accounts/cosmos1kaefh2tuh7syp8x0zy9a3wspnhyn50rulsq5fy

Account balance:
	[{"denom":"uatom","amount":"2488900"}]

Sent 0.0001 ATOM to cosmos1s2qeaefnchywaayfuxkdw7g8stcy47jkjayqxd:
	https://explorer.theta-testnet.polypore.xyz/transactions/B175383C3CB129D2A19D00FA3B3C7D0E130D62F788E2A9A89B147C777F6B0ACC
```
