# Example: `with-balances`

Demonstrates the Turnkey balance and asset APIs: fetch token balances for a wallet address, or list supported assets on a network.

> **Note:** The `getWalletAddressBalances` and `listSupportedAssets` APIs are currently in beta and not available for general use.

## Getting started

### 1/ Cloning the example

Make sure you have Node.js installed locally (v18+).

```bash
git clone https://github.com/tkhq/sdk
cd sdk/
corepack enable
pnpm install
```

### 2/ Setting up Turnkey

Create a `.env.local` file in this directory:

```bash
cp .env.local.example .env.local
```

Fill in your API credentials and organization ID. See the [Turnkey Quickstart](https://docs.turnkey.com/getting-started/quickstart) for help.

### 3/ Running the examples

**Get balances** for a wallet address:

```bash
pnpm get-balances
```

You'll be prompted for a wallet address and network identifier (CAIP-2 format, e.g. `eip155:1` for Ethereum mainnet or `eip155:8453` for Base). Displays a table of token balances with USD values.

**List supported assets** on a network:

```bash
pnpm list-supported-assets
```

You'll be prompted for a network identifier. Displays a table of all supported assets with their symbol, CAIP-19 identifier, and decimals.
