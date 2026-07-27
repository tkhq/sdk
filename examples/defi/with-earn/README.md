# Example: `with-earn`

> [!NOTE]
> Turnkey Earn is in **early access**. The APIs are gated and may change; reach
> out to Turnkey to have it enabled for your organization.

Turnkey Earn end to end with `@turnkey/sdk-server`: deploy a fee wrapper for a
Morpho vault (one-time, from the parent org), then deposit, poll status, read
positions, and partially withdraw from the end-user wallet.

## Prerequisites

- Earn enabled for the parent org (early access — reach out to Turnkey; sub-orgs
  inherit via the parent).
- The parent org on a Pay-As-You-Go plan or higher (Pro+ for `SPONSOR="true"`).

## Setup

1. Copy `.env.local.example` to `.env.local` and fill it in. The parent-org
   credentials run the one-time `deploy-vault` step (the platform); the demo-org
   credentials and `SIGN_WITH` run the deposit/withdraw flow (the end user). The
   two can be the same org.
2. Fund `SIGN_WITH` on Base: USDC for deposits, plus ETH for gas if
   `SPONSOR="false"`.

## Run

One command per step; amounts and fee terms prompt on the terminal (env or
defaults otherwise). Steps 1-3 act as the parent org (platform), steps 4-6 as
the sub-org (end user). All quantities print in USD.

```bash
pnpm vaults        # 1. discover the vault catalog (names, chain, APY, TVL)
pnpm deploy-vault  # 2. choose a vault + fee terms, deploy the wrapper
                   #    args: [vault-address] [client-fee-bps] [fee-wallet]
pnpm org-position  # 3. platform view: wrapper, client fee, net APY, total deposited
pnpm deposit       # 4. deposit USDC from the end-user wallet (arg: [usdc])
pnpm positions     # 5. end-user position + accrued yield
pnpm withdraw      # 6. partial withdrawal (arg: [usdc])
pnpm positions     # 7. end-user position again
pnpm org-position  # 8. platform view again
pnpm fees          # client revenue: your accrued client fee, claimable now
pnpm claim         # release the accrued client fee to CLIENT_FEE_WALLET

pnpm demo          # runs the full step sequence above

# utility: send ETH from SIGN_WITH (e.g. to top up a deployer/paymaster)
pnpm transfer <to-address> <eth-amount>
```

Notes:

- Vaults must come from the `earn_vaults` catalog (Morpho VaultV2); v1
  MetaMorpho vaults are not wrappable.
- Activities complete at broadcast-enqueue time; the `earn_*_status` endpoints
  are what confirm a transaction actually landed on-chain.
- Position `currentValue` is a live ERC-4626 conversion rounded in the vault's
  favor, so it can read a unit or two under the ledger fields right after a
  deposit; the dust returns as yield accrues.
- `pnpm claim` releases the accrued client fee (held as wrapper shares) to
  `CLIENT_FEE_WALLET`. `release` is a permissionless PaymentSplitter call, so
  the fee wallet only needs a little ETH on Base for gas.
