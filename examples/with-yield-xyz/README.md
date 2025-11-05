# Example: `with-yield-xyz`

[Yield.xyz](https://yield.xyz/) is the ultimate yield infrastructure for Web3, providing one unified API for every yield across 75+ networks.
This example shows how to sign transactions to Yield.xyz vaults on Base Mainnet using Turnkey. It provides the following scripts:

- `discover.ts` is fetching available yields from Yield.xyz.
- `enter.ts` is approving and depositing USDC into a selected yield.
- `balance.ts` is checking your balance in any yield and fetches current yield stats.
- `exit.ts` is withdrawing an amount from the yield.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-yield-xyz/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A root user with a public/private API key pair within the Turnkey parent organization
- An organization ID

Make sure you have a [wallet](https://app.turnkey.com/dashboard/wallets) with an Ethereum wallet account created within this organization and have it funded with some ETH and USDC on Base Mainnet.

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `TURNKEY_API_PUBLIC_KEY`
- `TURNKEY_API_PRIVATE_KEY`
- `TURNKEY_ORG_ID`
- `TURNKEY_BASE_URL`
- `TURNKEY_WALLET_ADDRESS`
- `YIELD_ID`
- `YIELD_API_KEY`
- `RPC_URL`

### 3/ Discover a yield (with metadata)

```bash
pnpm discover
```

### 4/ Enter the yield (deposit via Yield.xyz)

```bash
pnpm enter
```

### 5/ Check user balance

```bash
pnpm balance
```

### 6/ Exit the yield (withdraw funds)

```bash
pnpm exit
```