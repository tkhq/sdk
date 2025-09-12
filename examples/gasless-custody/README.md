# Example: `gassless-custody`

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
$ cd examples/gassless-custody/
```

### 2a/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- A Turnkey wallet account (address), private key address, or a private key ID

### 2b/ Transferring Turnkey wallet to browser wallet

For fast development (do not do this in prod!!), export the Turnkey wallet you've just created, importing to a browser wallet like Metamask. You will need it for ZeroDev setup.

### 2c/ ZeroDev config

Create a ZeroDev account if you do not already have one. Visit the [ZeroDev Dashboard](https://dashboard.zerodev.app/), and from the Project view add your relevant networks and head to `Self Funded Paymasters`.
Choose a chain to deploy a `Verifying Paymaster` to, connect the wallet address from earlier, and with some testnet (or mainnet) balance choose to `Fund`.
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
- Optional: `TOKEN_ADDRESS`
- Optional: `TRANSFER_AMOUNT`

### 3/ Running the scripts

These scripts construct transactions via Turnkey and broadcast them via Infura. If the scripts exit because your account isn't funded, you can request funds on https://sepoliafaucet.com/, via Coinbase Wallet, etc.

#### Viem

```bash
$ pnpm start
```

This script will do the following:

1. instantiate a Turnkey Viem wallet client
2. instantiate a Viem public client (to be used to fetch onchain data)
3. create a ZeroDev Validator
4. create a ZeroDev Kernel Client (with Paymaster support)
5. generate a new recipient address
6. check token balances
7. constructs a gassless transaction from sender to this new address
8. automatically sweeps the balance from this new address to a provided OMNIBUS_ADDRESS

Check your terminal for more info!

