# Example: `with-solana`

This example walks through the following:

- Creation of a new Turnkey wallet with a new Solana account
- Monitoring of devnet tokens landing on that address
- Construction of a transaction sending the funds out with the `@turnkey/solana` signer

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v16+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-solana/
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

You can also add a Solana address underif you have one already:

```
SOLANA_ADDRESS=<your Turnkey Solana address>
```

Note that this is optional: the script gives you a fresh one if you don't specify one in your `.env.local` file

### 3/ Running the script

```bash
$ pnpm start
```

You should see output similar to the following:

```
creating a new Solana wallet in your Turnkey organization...

New Solana wallet created!
- Name: Solana Wallet 9dab
- Wallet ID: 28da5d1a-4d8d-57db-926a-ca36e1c31f63
- Solana address: ARWHYAx8aiNrMkNfCMJxA7FpBBxRdrRbi7Biuzcssxjs

Your new Solana address: "ARWHYAx8aiNrMkNfCMJxA7FpBBxRdrRbi7Biuzcssxjs"

💸 Your onchain balance is at 0! To continue this demo you'll need devnet funds! You can use:
- The faucet in this example: `pnpm run faucet`
- The official Solana CLI: `solana airdrop 1 ARWHYAx8aiNrMkNfCMJxA7FpBBxRdrRbi7Biuzcssxjs`
- Any online faucet (e.g. https://faucet.triangleplatform.com/solana/devnet)

To check your balance: https://explorer.solana.com/address/ARWHYAx8aiNrMkNfCMJxA7FpBBxRdrRbi7Biuzcssxjs?cluster=devnet

--------
? Do you have devnet funds in ARWHYAx8aiNrMkNfCMJxA7FpBBxRdrRbi7Biuzcssxjs? (Y/n)Y

? Amount (in Lamports) to send to tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C: 6000000
New signature: dac3995b81a464fdcd5f914f0264695380562f432387e8240422f6e591b4cf5465c12390042889f8d4890242d289b98fd9a29f808cdee11a745c27c497b2fe0d
(base58: 5NgSjswvnt44URmD5wPqw7yejueo94Ji7DTdPys5BvBwPxftWZGypYtqVbYjT9PtL3gg8ay3WARNwq87kTWzvupY)

Transaction broadcast and confirmed! 🎉
https://explorer.solana.com/tx/5NgSjswvnt44URmD5wPqw7yejueo94Ji7DTdPys5BvBwPxftWZGypYtqVbYjT9PtL3gg8ay3WARNwq87kTWzvupY?cluster=devnet
```

Enjoy!
