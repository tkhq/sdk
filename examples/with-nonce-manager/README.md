# Example: `with-nonce-manager`

This example shows how to construct and broadcast a transaction using [`Ethers`](https://docs.ethers.org/v6/api/providers/#Signer) with Turnkey.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-nonce-manager/
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
- `INFURA_KEY` -- if this is not set, it will default to using the Community Infura key

### 3/ Running the scripts

The following scripts will construct transactions via Turnkey and broadcast via Infura. If a script exits because your account isn't funded, you can request funds on https://goerlifaucet.com/, https://faucet.paradigm.xyz/, or Coinbase Wallet.

```bash
$ pnpm start-simple-sequential
```

This script will create and broadcast 5 simple send transactions, where the next transaction will only be broadcast if the current gets confirmed onchain.

See the following for a sample output:

```
Network:
	goerli (chain ID 5)

Address:
	0x1024a8cc2156D8B8169255D250ddB16d59A22657

Balance:
	0.185931598081269653 Ether

Transaction count:
	92

Sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0xdb370edbb8b8364fa65e2b0ce3aea069bce652740817b606745b47452761e20d

Sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0x1d999726c0f5f30717889098195eaa1372cbf515951084e6922d5c2a78121c03

Sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0x3cc77cdf0c76a46263cee6887db0570b842b1f0e1aa600537d82eee858c531e5

Sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0xb381dd8e3f43e3e7e08595bfe64b582179e93243f2b129f3502d782bee5fe7dd

Sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0x2925ade587ade1b391880556c797b542137ad2a269ae3eccf0391054e7b866b1
```

Next, we have:

```bash
$ pnpm start-managed-optimistic
```

This script will immediately broadcast 3 simple send transactions and repeatedly poll their status. If a transaction exceeds the specified `DEFAULT_TX_WAIT_TIME_MS` threshold, it will be retried with multiplied gas fee parameters. If the `DEFAULT_TOTAL_WAIT_TIME_MS` threshold is breached, the script will terminate. See definitions for these values in `src/constants.ts`.

The following is a sample output when all 3 transactions succeed on the first attempt:

```
Network:
	goerli (chain ID 5)

Address:
	0x1024a8cc2156D8B8169255D250ddB16d59A22657

Balance:
	0.184600722711123653 Ether

Transaction count:
	119

Sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108 with nonce 119:
	https://goerli.etherscan.io/tx/0xfda498a5f17147d08d2b0da80419e86e68f0abd5ba8274941ed2312c869549b6

Sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108 with nonce 120:
	https://goerli.etherscan.io/tx/0x9b34169917b8b3e708dcf2ebe21c172600697561acc90d9d6be066e3216a0f05

Sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108 with nonce 121:
	https://goerli.etherscan.io/tx/0xa69ce9dd7a8f71430cb7b7526d569ac0f5347f81203da568e260eccfb8dd725e

All transactions processed!
```

And here's a sample output when transactions do _not_ succeed on the first attempt and require updates. Notice that errors due to race conditions are handled, and transaction processing continues until the queue is fully consumed.

```
Network:
	goerli (chain ID 5)

Address:
	0x1024a8cc2156D8B8169255D250ddB16d59A22657

Balance:
	0.184825160211858653 Ether

Transaction count:
	116

Sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108 with nonce 116:
	https://goerli.etherscan.io/tx/0x0aaf5e0db37ee3d3ba5a74ea812335fd7c5eb7a84fa1d51ea618c8d46cca8cbe

Sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108 with nonce 117:
	https://goerli.etherscan.io/tx/0x70050c06e8bb48d6323bb1d3c30a87ae8df6071101d3bab64bb53a640b5ed56e

Sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108 with nonce 118:
	https://goerli.etherscan.io/tx/0xd8d88d145dab8f63e8327256b9abc5e2d7334f260c868ad03ead1a28ac5e7fd1

Updated transaction with nonce 116 sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0x6f0e60f17990804534cc9cfee70ec3ab2b0d3cadc2b7325c2147f6be3a19e819

Updated transaction with nonce 116 sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0x2aee4780b4437b122da25d03a40b0dfd1038cf69bd2005328a9cce15ea233bc8

Encountered error: /Users/andrew/tkhq/code/sdk/node_modules/.pnpm/@ethersproject+logger@5.7.0/node_modules/@ethersproject/logger/lib/index.js:238
	var error = new Error(message);
                    ^

Error: nonce has already been used (...ethers error details...)

Updated transaction with nonce 117 sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0x596fa7a5d84fab4ae3591ab93f4ed8bc754b7c1fb95174a7dc2d6cae7cceaa25

Encountered error: /Users/andrew/tkhq/code/sdk/node_modules/.pnpm/@ethersproject+logger@5.7.0/node_modules/@ethersproject/logger/lib/index.js:238
	var error = new Error(message);
                    ^

Error: nonce has already been used (...ethers error details...)

Updated transaction with nonce 118 sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0x0c250ec67c0764672da63763e39fddf08147250826491294402ad1f4e118b465

Updated transaction with nonce 118 sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0xb4088189a3b7aad86d5dc78165308918bfcd485efe38f5944fe6d8c9c386b636

Updated transaction with nonce 118 sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0x56b7892e01db2de7b0dbcf30e0eb36aae0ca59db0c24571ac64ce3322eec26a1

Updated transaction with nonce 118 sent 0.0 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0x8c763b6396d2b9b31b2fcc5e2940d7e05ce4d32d897cf7df3f0889fb4eb07f53

All transactions processed!
```
