# Example: `with-ethers`

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
$ cd examples/with-ethers/
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
- `PRIVATE_KEY_ID` -- if you leave it blank, we'll create one for you via calling the Turnkey API
- `INFURA_KEY` -- if this is not set, it will default to using the Community Infura key

### 3/ Running the scripts

```bash
$ pnpm start
```

This script will do the following:

1. sign a raw payload
2. send ETH (via type 2 EIP-1559 transaction)
3. deposit ETH into the WETH contract (aka wrapping)

Note that these transactions will all be broadcasted sequentially.

The script constructs a transaction via Turnkey and broadcasts via Infura. If the script exits because your account isn't funded, you can request funds on https://goerlifaucet.com/ or https://faucet.paradigm.xyz/.

Visit the Etherscan link to view your transaction; you have successfully sent your first transaction with Turnkey!

See the following for a sample output:

```
Network:
	goerli (chain ID 5)

Address:
	0x064c0CfDD7C485Eba21988Ded4dbCD9358556842

Balance:
	0.07750465249126655 Ether

Transaction count:
	14

Turnkey-powered signature:
	0x97da598ac1ad566e77be7c7d9cc77339730e48c557c5d6f32f93d9fdeeed13472b1faf20f1e457a897a409f31b9e680ad6b02086ac4fb9aa693ce10374976b201c

Recovered address:
	0x064c0CfDD7C485Eba21988Ded4dbCD9358556842

Turnkey-signed transaction:
	0x02f8668080808080942ad9ea1e677949a536a270cec812d6e868c881088609184e72a00080c001a09881f59e48500ef8960ae1cb94e0c862e7d613f961c250b6f07b546a1b058b1da06ba1871d7aed5eb8ea8cb211a0e3e22a1c6b54b34b4376d0ef5b1daef4100c8f

Sent 0.00001 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0xe034bdc597766719aef04b1d08998e606e85da1dd73e52fad8586a7d79d659e0

WETH Balance:
	0.00007 WETH

Wrapped 0.00001 ETH:
	https://goerli.etherscan.io/tx/0x7f98c1b2c7ff7f8ab876b27fdcd794653d8b7f728dbeec3b1d403789c38bcb71
```

```bash
$ pnpm start-legacy-sepolia
```

This script will do the following:

1. send ETH (via type 0, EIP-155-compliant legacy transaction)
2. deposit ETH into the WETH contract (aka wrapping)

Note that these transactions will all be broadcasted sequentially. Additionally, Ethers v5 is only compatible with the Sepolia network if paired with Infura (Ethers v5 does not supported Alchemy with Sepolia at this time).

The script constructs a transaction via Turnkey and broadcasts via Infura. If the script exits because your account isn't funded, you can request funds on https://sepoliafaucet.com/ or via Coinbase Wallet.

Visit the Etherscan link to view your transaction; you have successfully sent your first transaction with Turnkey!

See the following for a sample output:

```
Network:
	sepolia (chain ID 11155111)

Address:
	0xc4f1EF91ea582E3020E9ac155c3b5B27ce1185Dd

Balance:
	0.049896964862611 Ether

Transaction count:
	4

Turnkey-signed transaction:
	0xf86c048308b821825208942ad9ea1e677949a536a270cec812d6e868c881088609184e72a000808401546d72a0883137063bfa04e1c6be6f79789f53e4226455ae1cbc4d610d164334a6e12c83a06dae6bd75b6cb28a7ed2548f207f860dd56a49c4bd63a642d7728d592225e408

Sent 0.00001 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://sepolia.etherscan.io/tx/0xf4c3e6bd5c6a635088dc7fc7c0d7a715beb340a7fbff67daf0adc666709e23f1

WETH Balance:
	0.0 WETH

Wrapped 0.00001 ETH:
	https://sepolia.etherscan.io/tx/0x428a6f3c24f6f0c2de34f41776566c875bd56bfe4d5d8db4a7ef57c2c4e69dec
```
