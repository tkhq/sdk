# Example: `with-gas-station-batch`

This example shows how to batch multiple DeFi calls into **one Turnkey activity, one policy evaluation, and one atomic on-chain transaction** using `ACTIVITY_TYPE_ETH_SEND_TRANSACTION_V2` with Gas Station sponsorship (EIP-7702), against Aave v3 on **Base Sepolia**:

- `faucet.ts` mints 100 test USDC from Aave's faucet — itself a sponsored activity, so the wallet **never needs ETH**
- `enter.ts` approves the Aave Pool and supplies 100 USDC — **two calls, one activity, one tx**
- `exit.ts` withdraws the full position — the "emergency exit" pressed as a single sponsored activity
- `createPolicy.ts` (optional) authorizes a non-root user to submit V2 batches from this wallet and nothing else

Compare with [`with-aave`](../with-aave/), where approve and supply are separate transactions: separate signatures, separate policy evaluations, and a window where the approval is live but unused. With V2 batching the calls execute atomically — all succeed or all revert — and Turnkey both signs **and broadcasts**, so there is no client-side RPC on the write path.

Key contract addresses come from the [Aave Address Book](https://www.npmjs.com/package/@bgd-labs/aave-address-book):

- USDC: `AaveV3BaseSepolia.ASSETS.USDC.UNDERLYING`
- Pool: `AaveV3BaseSepolia.POOL`
- Faucet: `MiscBaseSepolia.FAUCET`

## How it works

Each script builds an ordered list of `{ to, data }` calls and submits them under a single activity:

```ts
const result = await client.ethSendTransaction({
  from: process.env.SIGN_WITH,
  caip2: "eip155:84532", // Base Sepolia
  sponsor: true, // Gas Station pays gas; >1 call requires sponsor=true
  calls: [
    { to: USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [POOL, amount] }) },
    { to: POOL, data: encodeFunctionData({ abi: poolAbi, functionName: "supply", args: [USDC, amount, me, 0] }) },
  ],
});
```

Turnkey signs the batch, composes it into a single EIP-7702 transaction via the `TKGasStation` contract, broadcasts it, and returns a `sendTransactionStatusId`. The example polls `getSendTransactionStatus` until the transaction hash is available and prints a Basescan link.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/defi/with-gas-station-batch/
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

### 4/ Running the scripts

```bash
# Mint 100 test USDC (sponsored — no ETH needed)
$ pnpm faucet

# Approve + supply to Aave v3 in ONE atomic transaction
$ pnpm enter

# Withdraw the full position — the "emergency exit"
$ pnpm exit
```

Each script prints the Turnkey activity id (visible in the [Turnkey dashboard](https://app.turnkey.com), attributed to the submitting user) and a Basescan link to the single on-chain transaction.

## Policies

If the submitting user is a root user (with root quorum threshold 1), activities are approved by root quorum. To run the batch path under an explicit policy — e.g. for a non-root automation user — run:

```bash
$ pnpm createPolicy
```

which installs:

```text
condition: activity.type == 'ACTIVITY_TYPE_ETH_SEND_TRANSACTION_V2'
        && eth.tx.from == '<SIGN_WITH>'
consensus: approvers.any(user, user.id == '<NONROOT_USER_ID>')
```

One activity means one policy evaluation for the whole batch. Note that per-call predicates for the V2 `calls[]` array (e.g. constraining each call's `to`/selector, as `eth.tx.to`/`contract_call_args` do for single-transaction signing) are evolving — for defense-in-depth, validate the call list server-side before submitting, and see the [policy language docs](https://docs.turnkey.com/features/policies/language) for the current predicate surface.
