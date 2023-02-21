# Example: `with-uniswap`

This example shows how to construct and broadcast Uniswap-related transactions, built on top of [`Ethers`](https://docs.ethers.org/v5/api/signer/) with Turnkey.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v16+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-uniswap/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://turnkey.readme.io/docs/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- A (crypto) key ID

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `PRIVATE_KEY_ID`
- `INFURA_KEY` -- if this is not set, it will default to using the Community Infura key

### 3/ Running the script
There is currently one script you can run (more to be added), located in `package.json`: 
1. `univ3-swap.ts`: a simple Uniswap trade, routed via the v3 engine. Heavily based on [Uniswap's v3 trading examples](https://github.com/Uniswap/examples/tree/main/v3-sdk/trading/).

Configure your trade via `config.ts`, namely `UniV3SwapConfig`. Ensure you have sufficient funds to make the trade. If you have insufficient funds, your transaction will fail either at broadcast time, or onchain. Furthermore, note that this utilizes `TradeType.EXACT_INPUT` -- if you would like to be lenient with inputs and more strict with outputs (the funds you will *receive* as a result of the trade), consider using `TradeType.EXACT_OUTPUT`.

```bash
$ pnpm start
```

The script constructs a transaction via Turnkey and broadcasts via Infura. If the script exits because your account isn't funded, you can request funds on https://goerlifaucet.com/.

Visit the Etherscan link to view your transaction; you have successfully made your first transaction with Turnkey!

```
Network:
	goerli (chain ID 5)

Address:
	0xA16d17B5bd27b657dB0E973983B8C1848aeC257e

Balance:
	0.023383035198168014 Ether

Transaction count:
	14

Successfully prepared trade:
	<JSON blob>

Successfully executed trade via Uniswap v3:
	https://goerli.etherscan.io/tx/0x254a6561c0607dd0af530c5ba031c408a32c4554b73a87cac8490b12e42b5b92
```
