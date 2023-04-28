# Example: `with-gnosis`

This example shows how to construct and broadcast a transaction using [`Ethers`](https://docs.ethers.org/v5/api/signer/) with Turnkey.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v16+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-gnosis/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://turnkey.readme.io/docs/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- A (crypto) private key ID

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `PRIVATE_KEY_ID_1` -- if you leave it blank, we'll create one for you via calling the Turnkey API
- ... any additional private keys you may need for your Safe
- `INFURA_KEY` -- if this is not set, it will default to using the Community Infura key

### 3/ Running the scripts

```bash
$ pnpm start
```

By default, this script will do the following:

1. create a new Gnosis Safe (e.g. 3/3 multisig)
2. initiate a Safe transaction
3. approve transaction onchain using each signer
4. execute transaction once all approvals have been obtained

Note that these transactions will all be broadcasted sequentially. Additionally, this script uses Sepolia as a Gnosis Factory address is currently deployed and live on the network.

The script constructs a transaction via Turnkey and broadcasts via Infura. If the script exits because your account isn't funded, you can request funds via https://sepoliafaucet.com/, or via Coinbase Wallet (under developer settings).

Visit the Etherscan link to view your transaction; you have successfully sent your first transaction with Turnkey!

See the following for a sample output:

```
Address 1:
        0x1Bce4a8De35Cf22aCaA4D167C722dD80C14Eb0Ee

Balance 1:
        0.02352279499319971 Ether

Transaction count 1:
        5

Address 2:
        0xf285510B55f62d6787399409418590c9B6d246Fe

Balance 2:
        0.024841647999261024 Ether

Transaction count 2:
        2

Address 3:
        0xE69b8ede844DB94fe726Cf2537992e61A6a6Ea2e

Balance 3:
        0.024701216498605677 Ether

Transaction count 3:
        3

New Gnosis Safe Address:
        0x5de813F91736617D332C684320E0559E7E5aCE0E

Sent 0.00001 Ether to 0x5de813F91736617D332C684320E0559E7E5aCE0E:
        https://sepolia.etherscan.io/tx/0x80cfb23cf81abeb481271e1956d3a4009a3492739d249ee31add32e38cab9265

Signed transaction offchain using signer 1:
        0x7a5fef22c0c516d0cf9780fa65cdfa3f5584b0e4a90e834a59ee2c44ded7a6a6596be74817ce189cf4130ae1dc190d97370946c9224d8fe5cae725880335c20f20

Approved transaction using signer 2:
        https://sepolia.etherscan.io/tx/0x833db391d38da7777e45c931cbba429ca350b104d1495f6e43ce791e83f4bf9f

Approved transaction using signer 3:
        https://sepolia.etherscan.io/tx/0x9dadbcfa494e6936a041fdcb13fd36402ce8dd418e55a4fc146c236d46745f56

Executed transaction using signer 3:
        https://sepolia.etherscan.io/tx/0x599604d149129b484850c752e8be04099e19117fb68e2633014330bbc6b0e9f1
```
