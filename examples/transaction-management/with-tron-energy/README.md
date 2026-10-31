# Example: `with-tron-energy`

Fee-sponsored TRC-20 transfers on Tron with Turnkey: the sending wallet holds the token and **zero TRX**. Energy arrives as a short-lived on-chain delegation from a pluggable provider, the wallet signs its own transfer through Turnkey, and the rental is settled afterwards. This is the Tron analogue of the EVM/Solana paymaster examples in this directory.

## Tron's fee model in one paragraph

Tron has no gas price. A TRC-20 `transfer()` consumes **energy** (~65k to a recipient that already holds the token, ~131k to a zero-balance one, since that writes a fresh storage slot) plus ~345 **bandwidth**. Every activated account gets 600 free bandwidth a day — enough for about _one_ transfer, after which a wallet with no TRX cannot broadcast at all, because bandwidth is a separate resource that energy providers do not delegate. `sponsoredTransfer` therefore checks bandwidth before it rents anything; a wallet doing more than one transfer a day needs a bandwidth delegation or a little TRX of its own. Energy comes from staking TRX — or, if the account has none, the node burns TRX from its balance at the network energy price. Burning is the expensive path and it requires parking TRX at every sending wallet, which is exactly what custodial setups want to avoid. Because staked energy is _delegatable_ to any address, a whole rental market exists around it: someone else's stake covers your transaction for a fraction of the burn cost, and your wallets never hold TRX at all.

## Providers

The example defines a two-method `EnergyProvider` interface (`rent`, then `release` on the resulting rental) with two implementations. They represent the two ends of the trust spectrum:

|              | `tronsave` (marketplace API)                                        | `justlend` (on-chain protocol)                                                    |
| ------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Mechanism    | REST order against a prepaid account; delegation expires on its own | `rentResource()` on JustLend DAO's EnergyRental contract, prepay in TRX           |
| Typical cost | market rate (tens of SUN per energy), zero on-chain legs            | energy fee + 0.75 day of the security deposit, but the prepay floats ~20 TRX more |
| Settlement   | none — `release()` is a no-op                                       | `returnResource()` required, or the order is liquidated and the penalty forfeited |
| Counterparty | an off-chain operator and your prepaid float                        | none beyond the contract itself                                                   |
| Networks     | mainnet (Nile via the dev API)                                      | mainnet and Nile (separate deployments)                                           |

The practical production shape is a **priority-ordered chain** behind this same interface: a marketplace first for price, JustLend as the fallback that no API outage or operator can take away, and burning TRX as a last, alert-raising resort. The `energyProviderFromEnv` factory in `src/providers/` is the seam to build that on.

## What the scripts do

- `sponsoredTransfer` — end to end: estimate the transfer's real energy with a free `triggerConstantContract` call → rent the shortfall from the configured provider → **verify the delegation is visible on-chain** via `getAccountResources` → build the transfer and sign its `raw_data_hex` with Turnkey (`signRawPayload`, `HASH_FUNCTION_SHA256` — Tron's signing digest is sha256 of the raw transaction) → broadcast, poll the receipt → settle the rental.
- `rentEnergy` — rent for any activated address, watch the delegation land, settle.

## The four production footguns this example encodes

1. **The order acknowledgement is not the delegation.** Always confirm energy is visible on the receiving account before broadcasting the transaction that depends on it.
2. **`feeLimit` must cover the energy cost even when the energy is delegated.** The node caps a call's energy at `min(available, feeLimit / energyPrice)`, so a tiny feeLimit silently disables rented energy and the transaction fails `OUT_OF_ENERGY`.
3. **Broadcast acceptance is not execution.** A transaction can be included and still fail on-chain; poll `getTransactionInfo` and surface the receipt result.
4. **On-chain rentals must be returned.** JustLend refunds only via `returnResource()`; an order left past expiry is liquidated and its penalty forfeited. Every path after the prepay is committed has to reach `release()`: the delegation wait sits inside the `try`, the `finally` swallows its own failures so they cannot mask the original error (it warns that a deposit is outstanding instead), and the provider attempts a return itself if `rentResource` is broadcast but never confirms.

Three sizing notes: delegations are denominated in **staked TRX, not energy**, and the conversion ratio (`TotalEnergyLimit / TotalEnergyWeight`) floats with network-wide stake — read it live, never hardcode it. Same for the energy price and the per-token energy cost: estimate per transfer. And a marketplace price cap bounds the **unit** price, not the order total — TronSave bills a rental of a day or more per started day ([pricing](https://docs.tronsave.io/concepts/pricing-and-apy)), so a long `durationSec` multiplies the bill without ever tripping the cap.

## Getting started

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable
$ pnpm install -r
$ pnpm run build-all
$ cd examples/transaction-management/with-tron-energy/
$ cp .env.local.example .env.local
```

Fill in `.env.local` (the example defaults to **mainnet**):

- Turnkey credentials (`API_PUBLIC_KEY`, `API_PRIVATE_KEY`, `ORGANIZATION_ID`) — see the [Quickstart](https://docs.turnkey.com/getting-started/quickstart).
- `USER_ADDRESS`: a Turnkey Tron address (create one with the [`with-tron`](../../chain-integrations/with-tron/) example) holding a little USDT but no TRX. The address must be activated (have received something) before a delegation can target it.
- `TRONGRID_API_KEY` from [trongrid.io](https://www.trongrid.io) — TronGrid throttles anonymous mainnet traffic.
- **TronSave path (default):** `TRONSAVE_API_KEY` from [tronsave.io](https://tronsave.io). Top up the prepaid account by sending TRX to the deposit address returned by `GET /user-info`; a single ~65k-energy rental costs a few TRX at market rates.
- **JustLend path:** `ENERGY_PROVIDER=justlend`, `SPONSOR_ADDRESS` (a Turnkey wallet holding TRX for the prepay). Prepay is the energy fee (priced from the live on-chain `_rentalRate`) plus a one-day security deposit plus a liquidation penalty of at least 20 TRX, so **fund the sponsor with ~30 TRX more than you expect the rental to cost** — most of it comes back on `returnResource()`. Start with a small rental and watch one full rent/return cycle before sizing up.
- **Nile instead of mainnet:** `TRON_FULL_HOST=https://nile.trongrid.io`, Nile USDT `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf`, funded from a [faucet](https://nileex.io/join/getJoinPage). For TronSave add `TRONSAVE_API_BASE_URL=https://api-dev.tronsave.io/v2`; the JustLend provider picks up its Nile deployment from the host automatically. Rehearse here before spending mainnet TRX.

```bash
$ pnpm run rentEnergy          # rent → watch the delegation land → settle
$ pnpm run sponsoredTransfer   # estimate → rent → verify → Turnkey-signed transfer → settle
```
