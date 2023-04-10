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

Note that these transactions will all be broadcasted sequentially.

The script constructs a transaction via Turnkey and broadcasts via Infura. If the script exits because your account isn't funded, you can request funds on https://goerlifaucet.com/ or https://faucet.paradigm.xyz/.

Visit the Etherscan link to view your transaction; you have successfully sent your first transaction with Turnkey!

See the following for a sample output:

```
Address 1:
        0x1Bce4a8De35Cf22aCaA4D167C722dD80C14Eb0Ee

Balance 1:
        0.030020215203400146 Ether

Transaction count 1:
        10

Address 2:
        0xf285510B55f62d6787399409418590c9B6d246Fe

Balance 2:
        0.017074551136338144 Ether

Transaction count 2:
        2

Address 3:
        0xE69b8ede844DB94fe726Cf2537992e61A6a6Ea2e

Balance 3:
        0.066817774846202992 Ether

Transaction count 3:
        2

Gnosis Safe Address:
		https://goerli.etherscan.io/address/0xd49b176D26529AC14046C14A023eEDfDa0a4d878

Sent 0.00001 Ether to 0xd49b176D26529AC14046C14A023eEDfDa0a4d878:
        https://goerli.etherscan.io/tx/0x47b4ec32b8aa5b9f12594f74f49652bf0f6e4e19d7f0d14e3bde1ea0a2aa0d8e

Approved transaction using signer 1
		https://goerli.etherscan.io/tx/0x80552f02c54eabd15e02504fefd017b315e2fba4b7d754f144e5464b48285f3e

Approved transaction using signer 2
		https://goerli.etherscan.io/tx/0x3647430001093726876c5ac6d2fe567c01640175f9d7723395c2fc83793104f6

Approved transaction using signer 3
		https://goerli.etherscan.io/tx/0xe6cd8f037bc42d5ad9f3ce27f546a4b0022940bea9ef70990aad7c3c8afa7b89

Executed transaction using signer 3
		https://goerli.etherscan.io/tx/0xbbe05de0734aa602e7d972865fdc14bbcf59fc5c7b05354fd8f0c69a24b77cfb
```
