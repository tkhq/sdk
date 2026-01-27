# Example: `with-tempo`

This example shows how to construct and broadcast a transaction on the Tempo testnet using Turnkey.

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
        Tempo Testnet (Moderato) (chain ID 42431)

Address:
        0xDC608F098255C89B36da905D9132A9Ee3DD266D9

Nonce:
        5

✔ Amount to send … 1
✔ Destination address … 0xDC608F098255C89B36da905D9132A9Ee3DD266D9
✔ Sponsor fees via sponsor.moderato.tempo.xyz? … yes

AlphaUSD balance for 0xDC608F098255C89B36da905D9132A9Ee3DD266D9:
        1000000

Receipt:
        https://explore.tempo.xyz/tx/0x71ab0cbbd90b0774be500da229e81596b9402f90fe8cf91ee49002eec77307ec

Sent 1 AlphaUSD to 0xDC608F098255C89B36da905D9132A9Ee3DD266D9!
        https://docs.tempo.xyz/guide/payments/sponsor-user-fees
```

Note: if you have a consensus-related policy resembling the following

```
{
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.count() >= 2"
}
```

then the script will await consensus to be met. Specifically, the script will attempt to poll for activity completion per the `activityPoller` config passed to the `TurnkeyServerSDK`. If consensus still isn't met during this period, then the resulting `Consensus Needed` error will be caught, and the script will prompt the user to indicate when consensus has been met. At that point, the script will continue.
