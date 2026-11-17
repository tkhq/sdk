# Example: `with-earn`

Turnkey Earn end to end with `@turnkey/sdk-server`: enable a yield vault for
your organization (one-time, from the parent org), then deposit, poll status,
read positions, and withdraw (partial or full) from the end-user wallet.

The same scripts run on EVM (Morpho vaults and Aave reserves on Base) and on
Solana (Kamino K-Lend reserves). `CHAIN_CAIP2` picks the chain; everything else
follows from it.

## Prerequisites

- Earn enabled for the parent org (reach out to Turnkey; sub-orgs inherit via the parent).
  Solana Earn is gated separately from EVM Earn.
- For `SPONSOR="true"`, gas sponsorship enabled for the parent org. It is
  available on every paid plan, within the plan's
  [spend limits](https://docs.turnkey.com/features/transaction-management#spend-limits).

## Setup

1. Copy `.env.local.example` to `.env.local` and fill it in. The parent-org
   credentials run the one-time `deploy-vault` step (the platform); the demo-org
   credentials and `SIGN_WITH` run the deposit/withdraw flow (the end user). The
   two can be the same org.
2. Set `CHAIN_CAIP2` and fund `SIGN_WITH` on that chain: USDC for deposits, plus
   the native token for fees if `SPONSOR="false"` (ETH on Base; SOL on Solana,
   which also covers the rent of the user's share token account).
3. `CLIENT_FEE_WALLET` must be a wallet address in the parent org on the same
   chain (`0x…` on EVM, base58 on Solana).

## Run

One command per step; amounts and fee terms prompt on the terminal (env or
defaults otherwise). Steps 1-3 act as the parent org (platform), steps 4-6 as
the sub-org (end user). All quantities print in USD.

```bash
pnpm vaults        # 1. discover the vault catalog (names, chain, APY, TVL)
pnpm deploy-vault  # 2. choose a vault + fee terms, enable it for the org
                   #    args: [vault-address] [client-fee-bps] [fee-wallet]
pnpm org-position  # 3. platform view: wrapper, client fee, net APY, total deposited
pnpm deposit       # 4. deposit USDC from the end-user wallet (arg: [usdc])
pnpm positions     # 5. end-user position + accrued yield
pnpm withdraw      # 6. withdrawal (arg: [usdc], or "MAX" for a full exit)
pnpm positions     # 7. end-user position again
pnpm org-position  # 8. platform view again
pnpm fees          # client revenue: your accrued client fee, claimable now
pnpm fees claim    #   ...and release it to CLIENT_FEE_WALLET

pnpm demo          # runs the full step sequence above

# utility: send the native token or USDC from SIGN_WITH (e.g. to fund a wallet)
pnpm transfer <to-address> <amount> [usdc]
```

## Solana

Set `CHAIN_CAIP2` to `solana:mainnet` (Kamino's catalog) or `solana:devnet`.
On Solana:

- The catalog lists Kamino K-Lend reserves (stablecoins and SOL on Kamino's
  main market). `vaultAddress` is the reserve; `name` is the market plus the
  token.
- `deploy-vault` has Turnkey create a Kamino vault (kVault) for your org,
  allocated 100% to that reserve, with your fee set on it. The result's
  `wrapperAddress` is that vault, the deposit target. There is no splitter:
  fees accrue inside the vault and are split between you and Turnkey when
  claimed.
- Deposits and withdrawals are Solana transactions signed by `SIGN_WITH`. With
  `SPONSOR="true"` Turnkey pays the fee and rent; otherwise the wallet needs SOL.
- `pnpm fees claim` requires `CLIENT_FEE_WALLET` to already hold a token
  account for the vault's mint (USDC); the claim does not create one.

### Devnet

Kamino's catalog API covers mainnet only, so `pnpm vaults` is empty on devnet
and `VAULT_ADDRESS` must point at a devnet K-Lend reserve. Turnkey's own e2e
uses the devnet USDC reserve `XDU6q8pGhErjjG2bF4UDj4ZASUiUTuTDKnKkhHxWwPJ`,
whose mint is Circle's devnet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`,
available from [faucet.circle.com](https://faucet.circle.com)). Airdrop SOL to
`SIGN_WITH` from [faucet.solana.com](https://faucet.solana.com) if you run
unsponsored.

```bash
CHAIN_CAIP2="solana:devnet"
VAULT_ADDRESS="XDU6q8pGhErjjG2bF4UDj4ZASUiUTuTDKnKkhHxWwPJ"
CLIENT_FEE_WALLET="<base58 wallet in the parent org>"
SIGN_WITH="<base58 wallet in the demo org, holding devnet USDC>"
```

Then `pnpm deploy-vault && pnpm deposit && pnpm positions && pnpm withdraw MAX`.

## Notes

- EVM vaults must come from the `earn_vaults` catalog (Morpho VaultV2; v1
  MetaMorpho vaults are not wrappable). Aave entries use the reserve's asset
  address as `vaultAddress`.
- Activities complete at broadcast-enqueue time; the `earn_*_status` endpoints
  are what confirm a transaction actually landed on-chain. On Solana the tx hash
  they return is the base58 transaction signature.
- Position `currentValue` is a live share-price conversion rounded in the
  vault's favor, so it can read a unit or two under the ledger fields right
  after a deposit; the dust returns as yield accrues.
