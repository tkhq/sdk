# Example: `sui-with-quicknode`

A 3-command Sui demo that pairs **Turnkey** (signing) with a **node provider**
(broadcast + reads) over **gRPC**. Turnkey never touches RPC. The node provider
(Quicknode is recommended) handles
`TransactionExecutionService.ExecuteTransaction`,
`StateService.ListBalances`, and `LedgerService.ListTransactions` — all
through the `@mysten/sui/grpc` `SuiGrpcClient`.

> This example targets `@mysten/sui@^2.23.2` and uses the gRPC full-node API.
> Sui is deprecating the JSON-RPC API, and Quicknode is following that by
> deactivating their Sui JSON-RPC transport around July 2026. Quicknode
> supports Sui gRPC on both mainnet and testnet.

Commands:

1. `start:send` — build, Turnkey-sign, and broadcast a testnet SUI transfer.
2. `start:balance` — look up a wallet's SUI balance (MIST + SUI).
3. `start:history` — list a wallet's recent transactions split into inflows
   and outflows.

## Architecture: Turnkey for signing, node provider for everything else

Turnkey is a non-custodial signer. In this example it performs exactly one
operation: `signRawPayload` over the 32-byte blake2b digest of the Sui
`TransactionData` intent message. Every RPC round-trip — reference gas price,
coin selection, broadcast, balance lookups, transaction history — goes through
a `SuiGrpcClient` pointed at the URL in `QUICKNODE_SUI_URL`. When that variable
is unset the client falls back to the public testnet gRPC fullnode
(`https://fullnode.testnet.sui.io:443`) so the example still runs
out-of-the-box.

Set `QUICKNODE_SUI_URL` to your Quicknode Sui gRPC endpoint (mainnet or
testnet) to route all reads and broadcasts through Quicknode without changing
any other code. Set `SUI_NETWORK=mainnet` (default `testnet`) if you point at
a mainnet endpoint.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; `@mysten/sui@2.x` requires
Node 22 or later.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/chain-integrations/with-sui/sui-with-quicknode/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization. By following the
[Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you
should have:

- A public/private API key pair for Turnkey
- An organization ID

Once you've gathered these values, add them to a new `.env.local` file. Notice
that your private key should be securely managed and **_never_** be committed
to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and set:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `SUI_ADDRESS`
- `SUI_PUBLIC_KEY`
- `QUICKNODE_SUI_URL` (optional; falls back to the public testnet gRPC
  fullnode)
- `SUI_NETWORK` (optional; `testnet` by default, or `mainnet`)

### 3/ Running the commands

The example runs on Sui testnet by default. Fund `SUI_ADDRESS` from the
[Sui testnet faucet](https://faucet.sui.io/) before running `start:send`.

#### Send a testnet SUI transfer (Turnkey-signed, Quicknode-broadcast)

```bash
$ pnpm start:send
```

Sends a 0.001 SUI self-transfer, signed via Turnkey and broadcast through the
configured gRPC node provider via
`TransactionExecutionService.ExecuteTransaction`. Prints the resulting
transaction digest.

#### Look up a wallet's balances

```bash
$ pnpm start:balance                # uses SUI_ADDRESS from .env.local
$ pnpm start:balance 0xYourAddress  # or pass an address explicitly
```

Prints the wallet's balance for every coin type it holds (SUI plus any
fungible coins such as USDC and USDT). Each entry is split into the
coin-object portion (`coinBalance`) and the accumulator-tracked portion
(`addressBalance`), and formatted with the correct decimals resolved via
`SuiGrpcClient.getCoinMetadata` (with a fallback table for common coins).
Uses `SuiGrpcClient.listBalances`
(gRPC `StateService.ListBalances`, the gRPC replacement for the deprecated
JSON-RPC `suix_getAllBalances`).

#### List a wallet's transaction history

```bash
$ pnpm start:history                # uses SUI_ADDRESS from .env.local
$ pnpm start:history 0xYourAddress  # or pass an address explicitly
```

Queries the node provider once via gRPC `LedgerService.ListTransactions`
with an `affected_address` filter (matches transactions where the address
was sender, recipient, or an object owner), then classifies each result
locally by walking every `BalanceChange` attributed to the address. A
transaction with any positive per-coin delta appears in the Inflows list;
any transaction with any negative per-coin delta appears in the Outflows
list, so a mixed-coin swap (SUI out, USDC in) shows up in both. Prints
two labeled lists (digest, timestamp, and per-coin deltas with each
coin's resolved decimals and symbol).

The deprecated JSON-RPC `queryTransactionBlocks` filters `FromAddress` and
`ToAddress` do not exist on gRPC — `affected_address` is the closest
equivalent, and a single query covers both directions.
