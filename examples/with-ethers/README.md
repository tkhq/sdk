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

1. send ETH
2. deposit ETH into the WETH contract (aka wrapping)
3. withdraw WETH from the WETH contract (aka unwrapping)
4. transfer WETH

Note that these transactions will all be broadcasted sequentially.

The script constructs a transaction via Turnkey and broadcasts via Infura. If the script exits because your account isn't funded, you can request funds on https://goerlifaucet.com/ or https://faucet.paradigm.xyz/.

Visit the Etherscan link to view your transaction; you have successfully sent your first transaction with Turnkey!

See the following for a sample output:

```
Network:
	goerli (chain ID 5)

Address:
	0xA16d17B5bd27b657dB0E973983B8C1848aeC257e

Balance:
	0.023383035198168014 Ether

Transaction count:
	14

Turnkey-powered signature:
        0xc6118087e6e0eab0e01adb2239578f8a1a6524f2cac964a5e849f43e2fad5c6a2bb708e7255b216270603351bcb27ed28868f9da51d12105e91edd3c4b9a2e301b

Recovered address:
        0xA16d17B5bd27b657dB0E973983B8C1848aeC257e

Recovered pubkey:
        0x04044e84cb739cb3b9188cebb5917e2880f14c5b7a5a3e6f92b60acb5dc459bf4a5c35e1505fcc4ef30bab813d828b558ecd38e9e6ab7503ffada61d109a503d69

Turnkey-signed transaction:
	0x02f8668080808080942ad9ea1e677949a536a270cec812d6e868c881088609184e72a00080c001a0cae70a2ffd4b851ea22349c8f198a3aa8e47932064eecdc1691fa8ed65d09281a015434a47976515b60783cdc1c3f52fa29ff0e36575c31cf59f41b9802d95a8f5

// `eth-send.ts`
Sent 0.00001 Ether to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0x9ced217b3eb54d2d0dd49e62602af1584039091571c95489a63f0cd76601f81c

// WETH-related transactions show your WETH balance in advance
WETH Balance:
	0.00023 WETH

// `weth-deposit.ts`
Wrapped 0.00001 ETH:
	https://goerli.etherscan.io/tx/0xec76157de7c02ddf5a188273f238f1d194040ad1034e9037d9f30b10f0b92923

// `weth-withdraw.ts`
Unwrapped 0.00001 WETH:
	https://goerli.etherscan.io/tx/0xec76157de7c02ddf5a188273f238f1d194040ad1034e9037d9f30b10f0b92923

// `weth-transfer.ts`
Sent 0.00001 WETH to 0x2Ad9eA1E677949a536A270CEC812D6e868C88108:
	https://goerli.etherscan.io/tx/0xec76157de7c02ddf5a188273f238f1d194040ad1034e9037d9f30b10f0b92923
```
