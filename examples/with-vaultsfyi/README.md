# Example: `with-vaultsfyi`

[vaults.fyi](https://vaults.fyi) is the infrastructure layer for DeFi yield. One API gives you discovery, ready-to-sign transaction payloads, and position tracking across 80+ protocols and 1,000+ yield strategies on Ethereum, Base, Arbitrum, Optimism, Polygon, and 15+ other networks.

This example shows how to use Turnkey to sign vaults.fyi transactions on Base Mainnet under a policy that restricts the signer to the contracts vaults.fyi will actually target. It provides the following scripts:

- `discover.ts` lists the top vaults vaults.fyi recommends for the user's wallet, ranked by APY across every supported protocol.
- `deposit.ts` deposits into a chosen vault by fetching the ordered transaction list from vaults.fyi (typically approve + deposit) and signing each step.
- `balance.ts` lists every vault position the user holds across every supported network and protocol, including positions opened outside this app.
- `redeem.ts` redeems the full position from a vault.
- `claimRewards.ts` claims every available reward on the configured network using the two-step rewards/context → rewards/claim flow.

On top of this we showcase the Turnkey policy engine restricting the non-root user to only the addresses vaults.fyi will actually target:

- `createPolicy.ts` runs a dry-run deposit and redeem against vaults.fyi, extracts the actual `tx.to` addresses from the responses, and creates a Turnkey policy that allowlists exactly those addresses. This works for ERC-4626 vaults that target the vault contract directly (Morpho, Aave, Euler) and for protocols that route through intermediary contracts (Veda Boring Vaults via a Teller, queue-based redemptions, etc.).

## Why one address allowlist instead of per-function-selector policies

Other yield-routing APIs require enumerating function selectors per protocol because the calldata they return varies. vaults.fyi handles all protocol-specific encoding internally, so an address allowlist is sufficient. The dry-run pattern in `createPolicy.ts` discovers the right addresses for any vault without you needing to hardcode them.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-vaultsfyi/
```

### 2/ Setting up Turnkey

Follow the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) and create:

- A root user with a public/private API key pair within the Turnkey parent organization
- An organization ID
- A non-root user with a separate API key, removed from the root quorum (see [updateRootQuorum.ts](https://github.com/tkhq/sdk/blob/main/examples/kitchen-sink/src/sdk-server/updateRootQuorum.ts))
- A wallet with an Ethereum account, funded with ETH for gas and USDC on Base mainnet

### 3/ Get a vaults.fyi API key

Sign up at the [vaults.fyi portal](https://portal.vaults.fyi).

### 4/ Configure environment

```bash
cp .env.local.example .env.local
```

Fill in the values:

- `TURNKEY_API_PUBLIC_KEY`, `TURNKEY_API_PRIVATE_KEY`, `TURNKEY_BASE_URL`, `TURNKEY_ORGANIZATION_ID`
- `NONROOT_USER_ID`, `NONROOT_API_PUBLIC_KEY`, `NONROOT_API_PRIVATE_KEY`
- `SIGN_WITH` (your Turnkey wallet's Base address)
- `RPC_URL` (a Base mainnet RPC URL)
- `VAULTS_FYI_API_KEY`
- `NETWORK`, `ASSET_ADDRESS`, `VAULT_ID`, `DEPOSIT_AMOUNT`

### 5/ Discover a vault to deposit into

```bash
pnpm discover
```

Pick a `vaultId` from the output and set it as `VAULT_ID` in `.env.local`.

### 6/ Set up the Turnkey policy for the chosen vault

```bash
pnpm createPolicy
```

This dry-runs deposit and redeem against vaults.fyi, extracts the target addresses, and creates a single allow-policy.

### 7/ Deposit

```bash
pnpm deposit
```

### 8/ Check positions

```bash
pnpm balance
```

### 9/ Redeem the full position

```bash
pnpm redeem
```

### 10/ Claim rewards

```bash
pnpm claimRewards
```

Note: reward claim transactions may target different contracts than deposit and redeem. If they do, you'll need to extend the policy or attach a separate one. The same dry-run pattern from `createPolicy.ts` works against `getRewardsClaimActions` to discover those addresses.

## Resources

- [Turnkey cookbook entry for vaults.fyi](https://docs.turnkey.com/cookbook/vaultsfyi)
- [vaults.fyi docs](https://docs.vaults.fyi) and [OpenAPI spec](https://api.vaults.fyi/v2/documentation/)
