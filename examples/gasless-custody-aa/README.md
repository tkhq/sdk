# Example: `gasless-custody`

This example shows how to construct and broadcast a transaction using Turnkey with [`Viem`](https://viem.sh/docs/clients/wallet.html), and [`Zerodev`](https://docs.zerodev.app/sdk/getting-started/quickstart).

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/gassless-custody-aa/
```

### 2a/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- A Turnkey wallet account (address), private key address, or a private key ID


### 2b/ ZeroDev config

Create a ZeroDev account if you do not already have one. Visit the [ZeroDev Dashboard](https://dashboard.zerodev.app/), and from the Project view add your relevant networks and head to `Gas Policies`.
Choose a chain and tick `Sponsor all transactions`.
Finally, return to the Project's `General` tab and copy your Active Network's `Bundler/Paymaster RPC` URL.
You can find more details on the tutorial page here: https://docs.zerodev.app/sdk/getting-started/tutorial.

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `SIGN_WITH` -- A Turnkey wallet account address, private key address, or private key ID. 
- `ZERODEV_RPC`
- `OMNIBUS_ADDRESS`
- `TOKEN_ADDRESS`
- `TOKEN_ABI`

### 3/ Running the scripts

These scripts construct transactions via Turnkey and broadcast them via Infura. If the scripts exit because your account isn't funded, you can request funds on https://sepoliafaucet.com/, via Coinbase Wallet, etc.

#### Viem

```bash
$ pnpm start
```

This script will do the following:

1. instantiate a Turnkey server client
2. generate a fresh Turnkey wallet, representing the user
3. create relevant Account and Client types for the user and signer
4. generate EIP-7702 Authorizations for both user and signer
5. instantiate ZeroDev types for these new smart accounts
6. wait for user to deposit a small amount of ERC-20 token to user wallet
7. constructs a gassless transaction, in this case a self-send to demonstrate functionality
8. automatically sweeps the balance from this new address to a provided OMNIBUS_ADDRESS

Check your terminal for more info!

Some of the flows demonstrated are covered more completely in other developer examples, such as [ZeroDev's demo](https://7702.zerodev.app/turnkey),
 [`sweeper`](https://github.com/tkhq/sdk/tree/main/examples/sweeper), [`with-zerodev-aa`](https://github.com/tkhq/sdk/tree/main/examples/with-zerodev-aa), and further inspiration can be taken from [`with-eth-passkeys-galore`](https://github.com/tkhq/sdk/tree/main/examples/with-eth-passkeys-galore).