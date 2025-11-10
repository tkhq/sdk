# Example: `with-yield-xyz`

[Yield.xyz](https://yield.xyz/) is the ultimate yield infrastructure for Web3, providing one unified API for every yield across 75+ networks.
This example shows how to sign transactions to Yield.xyz vaults on Base Mainnet using Turnkey. It provides the following scripts:

- `discover.ts` is fetching available yields from Yield.xyz.
- `enter.ts` is approving and depositing USDC into a selected yield.
- `balance.ts` is checking your balance in any yield and fetches current yield stats.
- `exit.ts` is withdrawing an amount from the yield.

On top of it we showcase the power of the Turnkey policy engine by allowing a non-root Turnkey user to sign only the specific transactions required to interact with Yield.xyz’s Base USDC vault (which internally supplies to Morpho):

- `createPolicies.ts` uses an organization root user (RootQuorum) to create precise policy conditions for a non-root user, restricting their signing permissions to:
  - the USDC contract (`USDC_ADDRESS`), and
  - Yield.xyz’s Base USDC vault (`gtUSDCf_VAULT_ADDRESS`), which corresponds to Yield.xyz’s identifier for Morpho’s Base USDC vault (base-usdc-gtusdcf-0x236919f11ff9ea9550a4287696c2fc9e18e6e890-4626-vault).

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-yield-xyz/
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
- `TURNKEY_ORGANIZATION_ID`
- `TURNKEY_BASE_URL`
- `NONROOT_USER_ID`
- `NONROOT_API_PUBLIC_KEY`
- `NONROOT_API_PRIVATE_KEY`
- `SIGN_WITH`
- `YIELD_ID`
- `YIELD_API_KEY`
- `RPC_URL`
- `USDC_ADDRESS`
- `gtUSDCf_VAULT_ADDRESS`

### 3/ Setting up the policies for the non-root user

```bash
pnpm createPolicies
```

### 4/ Discover a yield (with metadata)

```bash
pnpm discover
```

### 5/ Enter the yield (deposit via Yield.xyz)

```bash
pnpm enter
```

### 6/ Check user balance

```bash
pnpm balance
```

### 7/ Exit the yield (withdraw funds)

```bash
pnpm exit
```
