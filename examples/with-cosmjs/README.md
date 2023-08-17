# Example: `with-cosmjs`

This example shows how to sign and broadcast a Cosmos transaction (on Celestia testnet) using [`CosmJS`](https://github.com/cosmos/cosmjs) with Turnkey.

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

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

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

The script signs your transaction via Turnkey and broadcasts on Celestia testnet. If the script exits because your account isn't funded, you can request funds via the [Celestia Discord](https://discord.gg/celestiacommunity).

Visit the explorer links to view your transaction; you have successfully sent your first transaction with Turnkey!

```
Compressed public key:
	03be8c88bc5e77aaa9a65ba29f38e892e68d736778fce1bf462d27bfaa3beefc93

Wallet address:
	celestia1kaefh2tuh7syp8x0zy9a3wspnhyn50ruw63ynf

Wallet on explorer:
	https://testnet.mintscan.io/celestia-incentivized-testnet/account/celestia1kaefh2tuh7syp8x0zy9a3wspnhyn50ruw63ynf

Account balance:
	[{"denom":"utia","amount":"99997600"}]

Sent 0.0001 TIA to celestia1vsvx8n7f8dh5udesqqhgrjutyun7zqrgehdq2l:
	https://testnet.mintscan.io/celestia-incentivized-testnet/txs/A89766D155C51E9F7C1B13DEDCB3E1E00D57F2950490184BC8477F0F081E9E92
```
