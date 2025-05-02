# Example: `with-tron`

This example walks through the following:

- Creation of a new Turnkey wallet with a new Tron account
- Obtaining Nile testnet TRX and USDT from a faucet to use for the rest of the examples
- Signing a TRX transaction
- Create a Turnkey policy to parse and guard Tron TRX and TRC-20 transactions

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-tron/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`

You can specify an existing Turnkey Tron address if you have one already:

```
TRON_ADDRESS=<your Turnkey Tron address>
```

Note that this is optional: the script gives you a fresh one if you don't specify one in your `.env.local` file.

### 3/ Running the scripts

There are 4 scripts that are meant to be run in order that will create a Tron wallet, sign a raw payload, create some policies and sign some transactions abiding by those policies.

#### createTronWallet

Start with the creating a Tron wallet script: `pnpm run createTronWallet`. This will give you a fresh Tron wallet secured by Turnkey. It will output a wallet address. Note: if this script is run multiple times it will fail because of a duplicate wallet name, you can change the wallet name in the code, or delete it from your dashboard at [app.turnkey.com/dashboard/wallets](https://app.turnkey.com/dashboard/wallets).

#### Obtaining testnet tokens

To follow along with the rest of the examples you should fund this wallet with TRX and USDT from this faucet: https://nileex.io/join/getJoinPage. Look for the sections labeled "Get 2000 test coins" and "Get 1000 USDT test tokens".

You can check your balance and view transactions well make later here: https://nile.tronscan.org/

Next you should set the `TRON_ADDRESS` environment variable in your .env.local file with the address that you have funded.

#### signRawPayload

The next example you can run is the `pnpm run signRawPayload`. This example demonstrates a typical SignRawPayload activity with your new Tron address!

#### transferTRXPolicy

The following example demonstrates creating policies for guarding `TransferContract` transactions, typically known as TRX transfers. Note: if this script is run multiple times it will fail because of a duplicate policy, you can change the policy name in the code, or delete it from your dashboard at [app.turnkey.com/dashboard/security](https://app.turnkey.com/dashboard/security). Run `pnpm run transferTRXPolicy`

#### transferTRC20Policy

The final example demonstrates how to create Tron policies for `TriggerSmartContract` transactions. `TriggerSmartContract` transactions are how TRC-20 contracts are called, but more generally any smart contract invocation on Tron is called using this transaction type. This policy specifically guards usage around the Tether smart contract. Run `pnpm run transferTRC20Policy`.
