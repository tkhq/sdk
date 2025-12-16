# Example: `with-tempo`

This example shows how to construct and broadcast a transaction on the Tempo testnet using Turnkey.

**Important:** During Tempo's testnet period Turnkey supports [Ethereum legacy transactions](https://docs.tempo.xyz/quickstart/evm-compatibility#transaction-differences)
with full parsing & policy support, and Tempo transactions with raw payload signing and some limited policy support. This SDK example demonstrates a Tempo transaction with raw payload signing. Legacy Ethereum transactions on Tempo can be utilized on Turnkey with [viem](https://github.com/tkhq/sdk/tree/main/examples/with-viem) and [ethers](https://github.com/tkhq/sdk/tree/main/examples/with-ethers).

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-tempo/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- A Turnkey wallet account (address), private key address, or a private key ID

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `SIGN_WITH` -- a Turnkey wallet account address, private key address, or private key ID. If you leave this blank, we'll create a wallet for you.
- `SPONSOR_WITH` -- (optional) a Turnkey wallet address to sponsor transaction fees. If not set, the public sponsor endpoint will be used when sponsoring is enabled.

### 3/ Running the scripts

The following is the default:

```bash
$ pnpm start
```

This script will do the following:

1. connect to and check your testnet balance
2. send some TIP-20 token via a type 2 EIP-1559 transaction

The script constructs a transaction, signs it with Turnkey and broadcasts through Tempo's client RPC.
If the script exits because your account isn't funded, you can request funds on https://docs.tempo.xyz/guide/use-accounts/add-funds.

Visit the explorer link to view your transaction; you have successfully sent your first transaction with Turnkey!

See the following for a sample output:

```
Network:
        Tempo Andantino (chain ID 42429)

Address:
        0x3758c7492Ea25199E6871A6F40fbE8118aED4848

TIP-20 Balance:
        999999.999729 tokens

Transaction count:
        1

✔ Amount to send  (default is 1 ) … 3
✔ Destination address (default is yourself) … 0x3758c7492Ea25199E6871A6F40fbE8118aED4848
Sent 3 TIP-20 tokens to 0x3758c7492Ea25199E6871A6F40fbE8118aED4848:
        https://explore.tempo.xyz/tx/0xe6a0cd779ae0ab8b8e92870d5373dfcaf09faf164a2e388cdca8c69760285b8f
```

Note: if you have a consensus-related policy resembling the following

```
{
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.count() >= 2"
}
```

then the script will await consensus to be met. Specifically, the script will attempt to poll for activity completion per the `activityPoller` config passed to the `TurnkeyServerSDK`. If consensus still isn't met during this period, then the resulting `Consensus Needed` error will be caught, and the script will prompt the user to indicate when consensus has been met. At that point, the script will continue.
