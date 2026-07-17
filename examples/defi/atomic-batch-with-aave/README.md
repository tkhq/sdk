# Example: `atomic-batch-with-aave`

This example opens a **leveraged Aave v3 position and unwinds it with one button press** — each side a single Turnkey activity, a single policy evaluation, and a single atomic on-chain transaction, using `ACTIVITY_TYPE_ETH_SEND_TRANSACTION_V2` with Gas Station sponsorship (EIP-7702) on **Base Sepolia**:

- `faucet.ts` mints 100 test USDC from Aave's faucet — itself a sponsored activity, so the wallet **never needs ETH**
- `positions.ts` prints the position: collateral, debt, health factor, wallet balance
- `enter.ts` — `approve` → `supply(90 USDC)` → `borrow(20 USDC)`: **3 calls, one atomic tx.** You now have collateral posted _and_ debt outstanding
- `exit.ts` — `approve` → `repay(max)` → `withdraw(max)`: **the emergency exit.** 3 calls whose order is load-bearing, executed all-or-nothing
- `exit-wrong-order.ts` — proof of atomicity: submits the exit with `withdraw` _before_ `repay`; Turnkey's pre-flight simulation fails the batch as a unit and the position is untouched
- `createPolicy.ts` (optional) authorizes a non-root user to submit V2 batches from this wallet and nothing else

## Why batching is the story

A leveraged position cannot be safely unwound step-by-step. Aave will not release collateral while debt is outstanding, so the sequence must be _repay, then withdraw_. Done as separate transactions, a failure or delay after `repay` leaves the position mid-unwind — debt repaid, collateral still exposed, keys warm while someone watches a screen. As a V2 batch the unwind is **atomic**: fully exited, or exactly as you were.

Compared with sending the same calls sequentially (as in [`with-aave`](../with-aave/)):

|                                               | 3 sequential transactions                                     | 1 V2 batch                                                     |
| --------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| Turnkey activities                            | 3                                                             | **1**                                                          |
| Policy evaluations                            | 3                                                             | **1**                                                          |
| Dashboard approvals (with consensus policies) | 3 — an approver can end up having approved a _partial_ unwind | **1** — approve one thing that either fully happens or doesn't |
| Partial-failure window                        | after every tx                                                | **none** (all-or-nothing)                                      |
| Gas                                           | paid by the wallet, 3×                                        | **sponsored** (Gas Station)                                    |
| Broadcast                                     | client RPC                                                    | **Turnkey signs _and_ broadcasts**                             |

Batching also gives a plain EOA composability that used to require deploying a router/multicall contract or renting a flashloan — position migrations (withdraw from protocol A → supply to protocol B), collateral swaps, leverage loops — with no contract to write, audit, or hold upgrade keys for.

Key contract addresses come from the [Aave Address Book](https://www.npmjs.com/package/@bgd-labs/aave-address-book): `AaveV3BaseSepolia.POOL`, `AaveV3BaseSepolia.ASSETS.USDC.UNDERLYING`, `MiscBaseSepolia.FAUCET`.

## How it works

Each script builds an ordered list of `{ to, data }` calls and submits them under a single activity:

```ts
const result = await client.ethSendTransaction({
  from: process.env.SIGN_WITH,
  caip2: "eip155:84532", // Base Sepolia
  sponsor: true, // Gas Station pays gas; >1 call requires sponsor=true
  calls: [
    { to: USDC, data: /* approve(pool, max) */ },
    { to: POOL, data: /* repay(USDC, max, 2, me) */ },
    { to: POOL, data: /* withdraw(USDC, max, me) */ },
  ],
});
```

Turnkey signs the batch, composes it into a single EIP-7702 transaction via the `TKGasStation` contract, broadcasts it, and returns a `sendTransactionStatusId`. The example polls `getSendTransactionStatus` until the transaction hash is available and prints a Basescan link. The write path never touches an RPC — only the read-only `positions.ts` does.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/defi/atomic-batch-with-aave/
```

### 2/ Setting up Turnkey

By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A user with a public/private API key pair within a Turnkey organization (or sub-organization)
- An organization ID
- A Turnkey wallet with an Ethereum account (the `SIGN_WITH` address)

The wallet needs **no funding of any kind** — every transaction in this example is sponsored by Turnkey's Gas Station.

### 3/ Setting up your `.env.local`

```bash
$ cp .env.local.example .env.local
```

Fill in `TURNKEY_API_PUBLIC_KEY`, `TURNKEY_API_PRIVATE_KEY`, `TURNKEY_ORGANIZATION_ID`, and `SIGN_WITH`. (`NONROOT_USER_ID` is only needed for `createPolicy.ts`.)

### 4/ Running the flow

```bash
# Mint 100 test USDC (sponsored — no ETH needed)
$ pnpm faucet

# Open the leveraged position: approve + supply 90 + borrow 20, one atomic tx
$ pnpm enter
# [before] collateral $0.00  | debt $0.00  | health factor ∞    | wallet USDC 100
# [after]  collateral $89.98 | debt $20.00 | health factor 3.87 | wallet USDC 30

# Optional: prove the atomicity — wrong-order exit reverts as a unit
$ pnpm exit-wrong-order

# 🔴 The emergency exit: approve + repay(max) + withdraw(max), one atomic tx
$ pnpm exit
# [after]  collateral $0.00  | debt $0.00  | health factor ∞    | wallet USDC ~100
```

Each write prints the Turnkey activity id (visible in the [Turnkey dashboard](https://app.turnkey.com), attributed to the submitting user) and a Basescan link to the single on-chain transaction.

Note: `enter.ts` supplies 90 of the 100 minted USDC and keeps 10 liquid so `repay(max)` can always cover accrued borrow interest.

## Policies

If the submitting user is a root user (with root quorum threshold 1), activities are approved by root quorum. To run the batch path under an explicit policy — e.g. for a non-root automation user whose _only_ permission is pressing this button — run:

```bash
$ pnpm createPolicy
```

which installs a policy scoped to **exactly the DeFi interactions this example uses** — the USDC, Aave Pool, and faucet contracts, restricted to the flow's function selectors:

```text
condition: activity.type == 'ACTIVITY_TYPE_ETH_SEND_TRANSACTION_V2'
        && eth.tx.from == '<SIGN_WITH>'
        && eth.tx.to in ['<USDC>', '<AAVE_POOL>', '<FAUCET>']
        && eth.tx.data[0..10] in ['0xc6c3bbe6', '0x095ea7b3', '0x617ba037',
                                  '0xa415bcad', '0x573ade81', '0x69328dec']
           // mint, approve, supply, borrow, repay, withdraw
consensus: approvers.any(user, user.id == '<NONROOT_USER_ID>')
```

`eth.tx.*` predicates are evaluated against **every call in the batch, all-or-nothing**: if any single call targets a contract or selector outside the allowlist, the entire batch is denied. Concretely (verified live on this flow):

- the faucet, enter, and exit batches are allowed and execute
- `USDC.transfer(...)` is denied — allowed contract, banned selector
- a call to any unlisted address is denied
- a batch mixing one valid `approve` with one unlisted call is **denied as a unit**

So the non-root user holds valid API keys yet can only faucet, enter, and exit — it cannot move funds anywhere else, and one policy evaluation (and, with consensus policies, one dashboard approval) covers the whole unwind. See the [policy language docs](https://docs.turnkey.com/features/policies/language) for the full predicate surface.
