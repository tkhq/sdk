# Example: `with-arc`

This example shows how to construct and broadcast a transaction on the Arc testnet using Turnkey.

If you want to see a similar EVM demo with passkeys, head to the example [`with-ethers-and-passkeys`](../with-ethers-and-passkeys/).

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-arc/
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

We have hardcoded the sole Arc testnet RPC & explorer (at the time of writing), but if you wished to customize this you're welcome to change for
different values.

### 3/ Running the scripts

 The following is the default:

```bash
$ pnpm start
```

This script will do the following:

1. connect to and check your testnet balance
2. send native token (USDC) via a type 2 EIP-1559 transaction

The script constructs a transaction via Turnkey and broadcasts through Arc's provided testner RPC.
If the script exits because your account isn't funded, you can request funds on https://faucet.circle.com/.

Visit the explorer link to view your transaction; you have successfully sent your first transaction with Turnkey!

See the following for a sample output:

```
Network:
        arc testnet (chain ID 5042002)

Address:
        0x3758c7492Ea25199E6871A6F40fbE8118aED4848

Balance:
        9.984325 USDC

Transaction count:
        3

✔ Amount to send in USDC (default is 1 cent) … 1.7
✔ Destination address (default is yourself) … 0xDa3F600A97078Ab97793D4Fd6f7C11cB37a5F565
Turnkey-signed transaction:
        0x02f877834cef520385012a05f200854bab82720082520894da3f600a97078ab97793d4fd6f7c11cb37a5f5658817979cfe362a000080c001a0894f9d9fed3c50a71636a0d78b5b4e3481356417a5c22720efa979065101601aa01a81d065684fa950b49c162bc950813ab0574392259ad05d82c6ae5efaab66f7

Sent 1.7 USDC to 0xDa3F600A97078Ab97793D4Fd6f7C11cB37a5F565:
        https://testnet.arcscan.app/tx/0x3f1ff99c95659df8ec7513fd72d4c13152fd1322a3ddaf3bcb62ecb709501e71
```

Note: if you have a consensus-related policy resembling the following

```
{
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.count() >= 2"
}
```

then the script will await consensus to be met. Specifically, the script will attempt to poll for activity completion per the `activityPoller` config passed to the `TurnkeyServerSDK`. If consensus still isn't met during this period, then the resulting `Consensus Needed` error will be caught, and the script will prompt the user to indicate when consensus has been met. At that point, the script will continue.