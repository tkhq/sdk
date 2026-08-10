# Example: `sui-with-quicknode`

A 3-command Sui demo that pairs **Turnkey** (signing) with a **node provider**
(broadcast + reads) over **gRPC**. Turnkey never touches RPC. The node provider
(QuickNode is recommended) handles `LedgerService.ExecuteTransaction`,
`GetBalance`, and `ListTransactions` — all through the `@mysten/sui/grpc`
`SuiGrpcClient`.

> This example targets `@mysten/sui@^2.23.2` and uses the gRPC full-node API.
> Sui JSON-RPC is deprecated and QuickNode has announced deactivation of that
> transport for July 2026. QuickNode supports Sui gRPC on both mainnet and
> testnet.

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

Set `QUICKNODE_SUI_URL` to your QuickNode Sui gRPC endpoint (mainnet or
testnet) to route all reads and broadcasts through QuickNode without changing
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

#### Send a testnet SUI transfer (Turnkey-signed, QuickNode-broadcast)

```bash
$ pnpm start:send
```

Sends a 0.001 SUI self-transfer, signed via Turnkey and broadcast through the
configured gRPC node provider via `LedgerService.ExecuteTransaction`. Prints
the resulting transaction digest.

#### Look up a wallet's SUI balance

```bash
$ pnpm start:balance                # uses SUI_ADDRESS from .env.local
$ pnpm start:balance 0xYourAddress  # or pass an address explicitly
```

Prints the wallet's SUI balance in both MIST and SUI, split into the
coin-object portion (`coinBalance`) and the accumulator-tracked portion
(`addressBalance`). Uses `SuiGrpcClient.getBalance`
(gRPC `LedgerService.GetBalance`, the gRPC replacement for the deprecated
JSON-RPC `suix_getBalance`).

#### List a wallet's transaction history

```bash
$ pnpm start:history                # uses SUI_ADDRESS from .env.local
$ pnpm start:history 0xYourAddress  # or pass an address explicitly
```

Queries the node provider once via gRPC `LedgerService.ListTransactions`
with an `affected_address` filter (matches transactions where the address
was sender, recipient, or an object owner), then classifies each result
locally as an inflow or outflow using the sign of the SUI `BalanceChange`
attributed to the address. Prints two labeled lists (digest, timestamp, and
SUI delta).

The deprecated JSON-RPC `queryTransactionBlocks` filters `FromAddress` and
`ToAddress` do not exist on gRPC — `affected_address` is the closest
equivalent, and a single query covers both directions.
