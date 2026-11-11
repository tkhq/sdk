# Example: `with-earn-delegated`

A customer gets a permanent deposit address on EVM chains and Solana. Stablecoins
that reach their Earn wallet are invested automatically by the platform: a watcher
picks the enabled Earn vault with the highest net APY, swaps into that vault's
asset with Turnkey Swap (cross-chain if needed), and deposits. When the customer
wants their money back, the platform withdraws and returns USDC on Base to the
deposit wallet.

The platform does this with a **non-root delegated user** whose only rights are
the policies the customer approved. It can't send funds anywhere except into the
enabled vaults and back to the customer's own deposit wallet. Builds on
[`with-earn`](../with-earn) and [`with-swap`](../with-swap).

> **Mainnet only, real funds.** Turnkey Swap and Earn run on mainnet. Use small
> amounts (about $10 is plenty).

## How it works

Each customer gets a sub-organization:

|                | What it is                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| Root user      | The customer, and only the customer. Here a mock API key (`CUSTOMER_API_*`) stands in for the customer's own login |
| Deposit wallet | Where the customer receives funds. One EVM account (the same address on every EVM chain) and one Solana account    |
| Earn wallet    | Where the platform works. The same two account types                                                               |
| Delegated user | The platform's API key (`DELEGATED_API_*`), **not** in the root quorum. Its policies are its only rights           |

The flow:

1. **`onboard-customer`** creates the sub-org (signed by the parent org). Signed
   by the customer's root key, it then creates the Earn wallet, the delegated
   user, and the delegated user's policies.
2. The customer moves stablecoins from the deposit wallet into the Earn wallet,
   for example with **`customer-send`**. Any transfer into the Earn wallet works
   the same way; the platform can't do this step.
3. **`watch`** (the platform, automated) sees the balance, re-reads the vault
   rates, picks the best vault, swaps, and deposits.
4. **`redeem`** (the platform) withdraws from the lowest-APY positions first,
   swaps to USDC on Base, and sends it to the deposit wallet.

### What the delegated user can do

Every policy is limited to the delegated user and signed from the Earn wallet.
There is deliberately no policy on the deposit wallet.

| Action                                | Limited to                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Swap quote and execute (EVM)          | From any supported stablecoin into an enabled vault's asset, or USDC on Base. Slippage at most `MAX_SLIPPAGE_BPS` |
| Swap quote and execute (Solana → EVM) | The same assets, and the output must go to the Earn wallet's own EVM address                                      |
| Earn deposit and withdraw             | The enabled wrappers only                                                                                         |
| Transfer                              | USDC on Base, to the customer's deposit wallet only                                                               |

The Solana swap policies are separate on purpose. A swap from Solana to EVM has
to name a destination; if the EVM policies accepted Solana inputs, a Solana swap
could send its output to any EVM address. A swap execute doesn't repeat the
signer check because it's bound to a quote, and the quote policies already pin
the signer to the Earn wallet.

`pnpm validate-policies` shows the limits. It tries requests the policies must
deny (sending from the deposit wallet, swapping into a non-stablecoin, going over
the slippage cap, signing a swap or Earn deposit from the deposit wallet, sending
Solana swap output elsewhere, and sending Earn-wallet funds anywhere but the
deposit wallet), plus requests they must allow, on EVM and Solana.

### Supported assets

There are no contract addresses to maintain. The lists are derived from Turnkey at
run time and printed by `onboard-customer` and `watch`:

- **Inputs** (accepted and swapped from): every asset `listSupportedAssets` marks
  `stable` on the chains in `CHAINS`, minus `EXCLUDED_CHAINS` and
  `EXCLUDED_SYMBOLS`. A stablecoin doesn't need its own vault, because it gets
  swapped.
- **Targets** (swapped into and invested in): the assets of the enabled Earn
  wrappers that are also inputs, plus USDC on Base for `redeem`.

Everything you might tune is in [`src/config.ts`](src/config.ts): the chains, the
exclusions (non-dollar stablecoins such as EURC, and Ethereum mainnet for gas
cost), the minimum balance worth investing, slippage, the polling interval, and
how long to wait for a cross-chain swap.

The policies are a snapshot of these lists. After you enable another vault or
change the config, re-run `pnpm onboard-customer` to update them, then restart
the watcher. It re-reads vault rates before every investment, but picks its
candidate vaults when it starts.

## Prerequisites

- Earn enabled for the parent org.
- Gas sponsorship enabled for the parent org, within your plan's
  [spend limits](https://docs.turnkey.com/features/transaction-management#spend-limits).
  Every send, swap, and Earn request here is sponsored, so neither wallet ever
  needs ETH or SOL.
- At least one stablecoin vault enabled in the Turnkey dashboard. To show a
  cross-chain swap, enable vaults on two chains (for example Base and Arbitrum).

## Setup

1. From the repo root, install and build the workspace packages:

   ```bash
   pnpm install -r
   pnpm run build-all
   ```

2. Copy `.env.local.example` to `.env.local` and fill in the parent org's API key
   and organization ID.
3. Generate the mock customer's key pair:

   ```bash
   pnpm keygen customer
   ```

   It writes both halves straight into `.env.local` (making the file readable
   only by you) and prints only the public key, so the private key is never
   shown. It won't replace a key that's already set. The key isn't registered
   anywhere yet: `pnpm onboard-customer` adds it to the customer's sub-org.

   The customer key must be fresh, not in any other sub-org, because the scripts
   find the customer's sub-org by that key.

4. For the delegated user, either run `pnpm keygen delegated`, or paste in a
   delegated key you already use for demos, as long as it isn't attached to a
   user in the parent org.

You can also generate keys with the
[Turnkey CLI](https://github.com/tkhq/tkcli)
(`turnkey generate api-key --key-name <name> --organization <parent org ID>`),
which saves them to local files without registering them anywhere;
`--organization` is required but only stored as a label. Its private key file
holds the key followed by a curve suffix (`<hex>:p256`); only the hex part goes
in `.env.local`.

## Run

```bash
pnpm keygen customer              # 0. once: the mock customer's key pair
pnpm onboard-customer             # 1. sub-org, Earn wallet, delegated user, policies (safe to re-run)
#                                 #    then fund the deposit wallet it prints
pnpm watch                        # 2. leave running: invests whatever reaches the Earn wallet
pnpm customer-send 5 USDC-base    # 3. in another terminal: deposit wallet → Earn wallet
pnpm customer-send 2 USDC-solana  #    Solana funds are swapped to the best EVM vault
#                                 # 4. stop the watcher (Ctrl-C)
pnpm redeem MAX                   # 5. withdraw, swap to USDC on Base, return to the deposit wallet
pnpm validate-policies            # 6. what the delegated user can't do
pnpm status                       #    any time: addresses, balances and positions (read-only)
```

Notes:

- `pnpm -s <script>` hides pnpm's own lines (the script echo).
- `pnpm watch --once` runs one pass. `pnpm watch --chain eip155:42161` invests
  only in vaults on that chain, which is a simple way to show a cross-chain swap.
- **Stop the watcher before `redeem`.** Otherwise it reinvests the withdrawn funds.
- The watcher fails closed: after a failed swap or deposit it skips that asset
  until it restarts. A cross-chain swap still pending after `SWAP_WAIT_MINUTES`
  isn't a failure; once it settles, a later poll deposits its output.
- `pnpm customer-send <amount> <asset> <to>` sends from the deposit wallet to any
  address. It's how the customer pays out.

## What this does and doesn't guarantee

The policies guarantee that the platform's key can only move the customer's funds
between supported stablecoins, into the enabled vaults, and back to the
customer's deposit wallet. It can't send them anywhere else, sign raw payloads,
or touch the deposit wallet.

They don't remove these risks:

- **Third-party protocols.** Yield comes from independent DeFi protocols (Morpho,
  Aave), not from your application or Turnkey. Deposits carry smart-contract,
  liquidity, and depeg risk, including loss of principal, and APY is variable.
- **Swap settlement.** Swaps are routed through a third-party provider. A
  cross-chain swap that fails refunds to the origin chain, which can take time.
- **The platform chooses the vault.** The customer approves the list of vaults
  up front; the platform picks among them.

## Key custody and cleanup

`CUSTOMER_API_PRIVATE_KEY` is the only root of the demo sub-org, so whoever holds
it controls those funds. It lives only in your `.env.local`. A platform holding
the customer's root key is a shortcut for this demo; in production, the
customer's own credential (their login or passkey) is the root, and the platform
never holds it.

The parent org has no rights in the sub-org, and the delegated key is limited to
the policies above.

To clean up: stop the watcher, run `pnpm redeem MAX`, send the funds to an address
you control with `pnpm customer-send <amount> USDC-base <address>`, then delete the
delegated user in the dashboard.

## Production notes

- **Trigger from webhooks, not polling.** A real platform would use Turnkey's
  balance webhooks (`BALANCE_CONFIRMED_UPDATES`), registered once on the parent
  org, to react to deposits across every customer sub-org.
- **One customer here.** The scripts find the sub-org by the customer's public
  key. A platform keeps its own mapping from customer to sub-org.
