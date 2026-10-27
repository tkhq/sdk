# Example: `with-tronsave`

Fee-sponsored TRC-20 transfers on Tron with Turnkey: the sending wallet holds the token and **zero TRX**. Energy is rented just-in-time from [TronSave](https://tronsave.io) as a short-lived on-chain delegation, the wallet signs its own transfer through Turnkey, and the delegation expires on its own.

On Tron, a TRC-20 `transfer()` consumes **energy** (~65k to a funded recipient, ~131k to a zero-balance one) plus ~345 bandwidth, which the account's free daily 600 bandwidth covers. Without energy, the sender burns TRX at the network rate — renting the energy instead typically costs a fraction of that and, more importantly for custodial setups, means deposit/user wallets never need to be funded with TRX at all. This is the Tron analogue of the EVM/Solana paymaster examples in this directory.

Flow (`sponsoredTransfer`):

1. Estimate the transfer's real energy cost with a free `triggerConstantContract` call.
2. Rent the shortfall from TronSave (fill-or-fail order, price-capped), then **verify the delegation is visible on-chain** via `getAccountResources` before proceeding — never trust the order acknowledgement alone.
3. Build the transfer, sign its `raw_data_hex` with Turnkey (`HASH_FUNCTION_SHA256` — Tron's signing digest is sha256 of the raw transaction), broadcast, and poll the receipt: broadcast acceptance is not execution, so surface on-chain failures like `OUT_OF_ENERGY` explicitly.

Two gotchas worth knowing even if you never run this example:

- The transaction's `feeLimit` must cover the energy cost **even when the energy is delegated** — the node caps a call's energy at `min(available, feeLimit / energyPrice)`, so a tiny feeLimit silently disables rented energy.
- TronSave orders are paid from a prepaid account tied to the API key (no per-order on-chain payment), which is what makes the rental a single HTTP call in the sweep path.

## Getting started

Clone and build the repo, then set up this example:

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable
$ pnpm install -r
$ pnpm run build-all
$ cd examples/transaction-management/with-tronsave/
$ cp .env.local.example .env.local
```

Fill in `.env.local`:

- Turnkey credentials (`API_PUBLIC_KEY`, `API_PRIVATE_KEY`, `ORGANIZATION_ID`) — see the [Quickstart](https://docs.turnkey.com/getting-started/quickstart).
- `USER_ADDRESS`: a Turnkey Tron address (create one with the [`with-tron`](../../chain-integrations/with-tron/) example) holding Nile USDT but no TRX. Get Nile TRX/USDT from a [faucet](https://nileex.io/join/getJoinPage) — and note the address must be activated (have received anything) before a delegation can target it.
- `TRONSAVE_API_KEY`: from [tronsave.io](https://tronsave.io). The default base URL is TronSave's dev API, which delegates on Nile; top up the prepaid account by sending TRX to the deposit address returned by `GET /user-info`.

## Running the scripts

```bash
# Rent energy for USER_ADDRESS and watch the delegation land on-chain
$ pnpm run rentEnergy

# End to end: estimate → rent the shortfall → verify → Turnkey-signed TRC-20 transfer
$ pnpm run sponsoredTransfer
```

For mainnet, set `TRONSAVE_API_BASE_URL=https://api.tronsave.io/v2`, point `initTronWeb` at `https://api.trongrid.io` (with a TronGrid API key), and use the mainnet USDT contract — the Nile one in `.env.local.example` is testnet-only.
