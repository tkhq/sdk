# Example: `with-aave`

This example shows how to use a Turnkey wallet to interact with Aave v3 on Base mainnet, supplying and withdrawing USDC. It provides the following scripts:

- `deposit.ts` approves the Aave Pool contract to spend USDC and deposits USDC into Aave
- `balance.ts` reads the aUSDC balance (eg. the deposit receipt)
- `withdraw.ts` withdraws an USDC amount from the pool

On top of it, we showcase the power of the Turnkey policy engine by allowing a non-root Turnkey user to only sign the specific transactions to the USDC and Aave Pool contract addresses:

- `createPolicy.ts` uses an organization root user (RootQuorum) to create a specific policies for a non-root user (`NONROOT_USER_ID`) that will be used to sign the transactions to Aave and USDC contracts.

Key contracts addresses used on Base Mainnet come from the [Aave Address Book](https://www.npmjs.com/package/@bgd-labs/aave-address-book)

- USDC: AaveV3Base.ASSETS.USDC.UNDERLYING
- aUSDC: AaveV3Base.ASSETS.USDC.A_TOKEN
- Pool: AaveV3Base.POOL

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-aave/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A root user with a public/private API key pair within the Turnkey parent organization
- An organization ID

The next step is to create another user within the organization with a different API key and remove it from the root quorum. You can do this from the Turnkey [dashboard](https://app.turnkey.com/dashboard/security/updateRootQuorum) or [API](https://docs.turnkey.com/api-reference/activities/update-root-quorum). Here's a simple [script](https://github.com/tkhq/sdk/blob/main/examples/kitchen-sink/src/sdk-server/updateRootQuorum.ts) that shows how to update the root quorum using `@turnkey/sdk-server`.

Finally, make sure you have a [wallet](https://app.turnkey.com/dashboard/wallets) with an Ethereum wallet account created within this organization and have it funded with some ETH and USDC on Base Mainnet.

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
- `INFURA_API_KEY`

### 3/ Setting up the policy for the non-root user

```bash
pnpm createPolicy
```

### 4/ Approve the vault to spend USDC and deposit USDC into the vault

```bash
pnpm deposit
```

### 5/ Check user share balance and vault data

```bash
pnpm balance
```

### 6/ Withdraw from the vault

```bash
pnpm withdraw
```
