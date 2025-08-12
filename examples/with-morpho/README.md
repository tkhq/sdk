# Example: `with-morpho`

[Morpho Vaults](https://docs.morpho.org/build/earn/getting-started?) are smart contracts that allow users to deposit assets into yield-generating vaults built on top of Morpho's lending protocol.
This examples shows how to sign transactions to Morpho's Steakhouse USDC Vault on Base Mainnet using Turnkey. It provides the following scripts:

- `deposit.ts` shows how to approve and deposit USDC
- `balance.ts` is checking the user vault share balance and the vault data
- `withdraw.ts` is withdrawing an USDC amount from the vault
- `redeem.ts` is getting all shares out from the vault

On top of it we showcase the power of the Turnkey policy engine by allowing a non-root Turnkey user to only sign the specific transactions with the USDC and Morpho's vault addresses:

- `createPolicy.ts` uses an organization root user (RootQuorum) to create a specific policies for a non-root user that will be used to sign the transactions to Morpho.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-morpho/
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
- `MORPHO_VAULT_ADDRESS`
- `USDC_ADDRESS`
- `BASE_CHAIN_ID`
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

### 7/ Redeem all shares from the vault

```bash
pnpm redeem
```
