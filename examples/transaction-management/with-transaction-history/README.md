# Example: `with-transaction-history`

Demonstrates the Turnkey wallet transaction history APIs: list EVM or Solana transactions for a wallet account address, with cursor pagination.

> **Note:** Transaction history requires the `TransactionHistory` feature flag on your organization and is not available for general use.

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

The wallet address must belong to a **wallet account** (standalone private key addresses are not supported).

### 3/ Running the examples

**List EVM transaction history:**

```bash
pnpm list-eth-transaction-history
```

You'll be prompted for a wallet address and network identifier (CAIP-2 format, e.g. `eip155:1` for Ethereum mainnet or `eip155:8453` for Base). The script fetches up to three pages of five transactions each, printing a summary table per page.

**List Solana transaction history:**

```bash
pnpm list-sol-transaction-history
```

You'll be prompted for a wallet address and network identifier (e.g. `solana:mainnet` or `solana:devnet`). Human-readable Solana aliases are normalized to canonical CAIP-2 values by the API.

## Pagination

Results are ordered newest-first. Each response includes optional `pageInfo` with:

- `hasNextPage` / `hasPreviousPage` — whether more pages exist in each direction
- `startCursor` / `endCursor` — opaque cursors valid only for the same address and CAIP-2 query

To fetch older transactions, pass `pageInfo.endCursor` as `paginationOptions.after` on the next request. To fetch newer transactions, use `paginationOptions.before` with `pageInfo.startCursor`.

Cursors must not be constructed or modified by clients.
