# Example: `with-solana`

This example walks through the following:
- Creation of a new Turnkey private key
- Derivation of a new Solana address
- Monitoring of devnet tokens landing on that address
- Construction of a transaction sending the funds out

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

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://turnkey.readme.io/docs/quickstart) guide, you should have:

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

You can also add a Turnkey Private Key ID if you have one already:
```
PRIVATE_KEY_ID=<your Turnkey Private Key ID>
```

This is optional: the script will create a new one if you don't specify one in your `.env.local` file

### 3/ Running the script

```bash
$ pnpm start
```

You should see output similar to the following:
```
creating a new Solana private key on your Turnkey organization...

New Solana private key created!
- Name: Solana Key ff73
- Private key ID: e082a9c4-046a-422c-9836-1910615d8100

Your Solana address: "6ziT1tk8YhQx8nEiJHAEM5eh9g4DnLwdek7Zfx7KYGAo"

💸 To continue this demo you'll need some devnet funds. You can use:
- The faucet in this example: `pnpm run faucet`
- The official Solana CLI: `solana airdrop 1 6ziT1tk8YhQx8nEiJHAEM5eh9g4DnLwdek7Zfx7KYGAo`
- Any online faucet (e.g. https://faucet.triangleplatform.com/solana/devnet)

To check your balance: https://explorer.solana.com/address/6ziT1tk8YhQx8nEiJHAEM5eh9g4DnLwdek7Zfx7KYGAo?cluster=devnet

--------
? Do you have devnet funds in 6ziT1tk8YhQx8nEiJHAEM5eh9g4DnLwdek7Zfx7KYGAo? (Y/n)Y

? Amount (in Lamports) to send to tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C: 6000000
New signature: dac3995b81a464fdcd5f914f0264695380562f432387e8240422f6e591b4cf5465c12390042889f8d4890242d289b98fd9a29f808cdee11a745c27c497b2fe0d
(base58: 5NgSjswvnt44URmD5wPqw7yejueo94Ji7DTdPys5BvBwPxftWZGypYtqVbYjT9PtL3gg8ay3WARNwq87kTWzvupY)

Transaction broadcast and confirmed! 🎉 
https://explorer.solana.com/tx/5NgSjswvnt44URmD5wPqw7yejueo94Ji7DTdPys5BvBwPxftWZGypYtqVbYjT9PtL3gg8ay3WARNwq87kTWzvupY?cluster=devnet
```

Enjoy!