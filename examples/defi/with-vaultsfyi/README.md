# Example: `with-vaultsfyi`

[vaults.fyi](https://vaults.fyi) is a DeFi yield aggregator that lets you discover, deposit, and withdraw from yield-generating vaults across multiple protocols and networks through a single API. This example shows how to use a Turnkey wallet with the vaults.fyi SDK to interact with DeFi vaults. It provides the following scripts:

- `setupPolicy.ts` discovers target contract addresses via dry-run and creates a Turnkey policy scoping a non-root user to only those addresses
- `discover.ts` finds the best yield opportunities for your wallet on a given network
- `deposit.ts` deposits into a vault (amount in base units)
- `positions.ts` lists all DeFi positions for your wallet
- `withdraw.ts` redeems your full position from a vault
- `setupRewardsPolicy.ts` discovers reward claim addresses and creates a policy for them
- `claimRewards.ts` claims any pending rewards on a given network

On top of it, we showcase the power of the Turnkey policy engine by allowing a non-root Turnkey user to only sign the specific transactions with the addresses discovered from vaults.fyi:

- `setupPolicy.ts` uses an organization root user (RootQuorum) to create specific policies for a non-root user that will be used to sign the transactions.

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

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A root user with a public/private API key pair within the Turnkey parent organization
- An organization ID

The next step is to create another user within the organization with a different API key and remove it from the root quorum. You can do this from the Turnkey [dashboard](https://app.turnkey.com/dashboard/security/updateRootQuorum) or [API](https://docs.turnkey.com/api-reference/activities/update-root-quorum). Here's a simple [script](https://github.com/tkhq/sdk/blob/main/examples/kitchen-sink/src/sdk-server/updateRootQuorum.ts) that shows how to update the root quorum using `@turnkey/sdk-server`.

Finally, make sure you have a [wallet](https://app.turnkey.com/dashboard/wallets) with an Ethereum wallet account created within this organization and have it funded with some ETH and the deposit token on your target network.

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `TURNKEY_API_PUBLIC_KEY`
- `TURNKEY_API_PRIVATE_KEY`
- `TURNKEY_BASE_URL`
- `TURNKEY_ORGANIZATION_ID`
- `SIGN_WITH`
- `NONROOT_USER_ID`
- `NONROOT_API_PUBLIC_KEY`
- `NONROOT_API_PRIVATE_KEY`
- `RPC_URL`
- `VAULTS_FYI_API_KEY` — sign up at the [vaults.fyi portal](https://portal.vaults.fyi) to get one

### 3/ Discover yield opportunities

```bash
pnpm discover <network>
```

### 4/ Setting up the policy for the non-root user

```bash
pnpm setup-policy <network> <vaultId>
```

### 5/ Deposit into a vault

```bash
pnpm deposit <network> <vaultId> <amount>
```

### 6/ List positions

```bash
pnpm positions <network>
```

### 7/ Full withdraw from a vault

```bash
pnpm withdraw <network> <vaultId>
```

### 8/ Set up rewards policy and claim rewards

```bash
pnpm setup-rewards-policy <network>
pnpm claim-rewards <network>
```
