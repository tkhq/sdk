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

1. Create a new Gnosis Safe (e.g. 3/3 multisig)
2. Initiate a Safe transaction
3. Approve transaction using offchain EIP-712 signature
4. Approve transaction using offchain raw signed message signature
5. Approve transaction onchain
6. Execute transaction once all approvals have been obtained

NOTES:

- If the script exits because your account isn't funded, you can request funds via https://goerlifaucet.com/, https://faucet.paradigm.xyz/, or Coinbase Wallet (developer settings).
- Transactions will all be broadcasted sequentially.
- Sepolia users: the Alchemy provider in Ethers v5 does not support Sepolia. Either use an alternative provider, or switch networks.

See the following for a sample output:

```
Address 1:
        0x1Bce4a8De35Cf22aCaA4D167C722dD80C14Eb0Ee

Balance 1:
        0.034412557714194554 Ether

Transaction count 1:
        20

Address 2:
        0xf285510B55f62d6787399409418590c9B6d246Fe

Balance 2:
        0.0135694405114308 Ether

Transaction count 2:
        4

Address 3:
        0xE69b8ede844DB94fe726Cf2537992e61A6a6Ea2e

Balance 3:
        0.06095101662527444 Ether

Transaction count 3:
        5

New Gnosis Safe Address:
        0x804ceF3146150033515EE212f13cd4fbEAE52f2a

Sent 0.00001 Ether to 0x804ceF3146150033515EE212f13cd4fbEAE52f2a:
        https://goerli.etherscan.io/tx/0x7d40034d769257cae94b990bfb979c7dc1328910765e55c38b698477e53d2fb2

Signed transaction offchain using signer 1. Signature:
        0x1b0c320ee49ceda13712cfef4ac57b8c7a03fe7033f0e5f45ca2f9015455a65158e344753afe4253dbbe7dfc8b9b67c9076ffedde485585562b291f6489126c61b

Signed transaction hash offchain using signer 2. Signature:
        0x7059168da2f2c10776b9aa7797aa9dc2d18e78c20b3b481f1428a8c099592b6f6599080ddacc8fe49bded3e133ba0d6d7be3de7ce633e7bfa225aba894b580481f

Approved transaction onchain using signer 3. Etherscan link:
        https://goerli.etherscan.io/tx/0xdd9a42defdc7533856c33cb2bf69f05049667896c860ed1b17b3b2af5d0e0523

Executed transaction using signer 3. Etherscan link:
        https://goerli.etherscan.io/tx/0xf67d40a06e068409fd2a4698f54a1cdf0311f6be33aae08c9f4740a944d92001
```
