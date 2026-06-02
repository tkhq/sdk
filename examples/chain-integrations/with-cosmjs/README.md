# Example: `with-cosmjs`

This example shows how to sign and broadcast a Cosmos transaction (on Celestia testnet) using [`CosmJS`](https://github.com/cosmos/cosmjs) with Turnkey.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

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
- `SIGN_WITH` -- if you leave it blank, we'll create a wallet for you via calling the Turnkey API

### 3/ Running the script

```bash
$ pnpm start
```

The script signs your transaction via Turnkey and broadcasts on Celestia testnet. If the script exits because your account isn't funded, you can request funds via the [Celestia Discord](https://discord.gg/celestiacommunity), or https://faucet.celestia-arabica-11.com/.

Visit the explorer links to view your transaction; you have successfully sent your first transaction with Turnkey!

```
Compressed public key:
	025adbb33ec36206ae2e022ddc55d3d083aeb9959311227a7699dcb31068286c79

Wallet address:
	celestia160pdug04aedlqhfeue5vhjjke5zgmtyruzk6w7

Wallet on explorer:
	https://arabica.celenium.io/address/celestia160pdug04aedlqhfeue5vhjjke5zgmtyruzk6w7

Account balance:
	[{"denom":"utia","amount":"4979900"}]

Sent 0.0001 TIA to celestia1vsvx8n7f8dh5udesqqhgrjutyun7zqrgehdq2l:
	https://arabica.celenium.io/tx/933236071C0AFEC756E09F4C2F14F52FAD56971FBD5E83D9E405B4A538D10E63
```
