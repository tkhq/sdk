# Example: `with-biconomy-aa`

This example shows how to construct and broadcast a transaction using Turnkey with [`Ethers`](https://docs.ethers.org/v6/api/providers/#Signer), [`Viem`](https://viem.sh/docs/clients/wallet.html), and [`Biconomy`](https://docs.biconomy.io/account).

If you want to see a demo with passkeys, it's coming 🔜™️!

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-biconomy-aa/
```

### 2a/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- A Turnkey wallet account (address), private key address, or a private key ID

### 2b/ Setting up Biconomy

The next step is to navigate to Biconomy to create a paymaster. Visit the [Biconomy Dashboard](https://dashboard.biconomy.io/) to create a your paymaster and find the following:

- Bundler URL
- Paymaster API Key

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
- `BICONOMY_BUNDLER_URL`
- `BICONOMY_PAYMASTER_API_KEY`

### 3/ Running the scripts

Note: there are two included — one for Viem and another for Ethers. See `package.json` for more details.

These scripts construct transactions via Turnkey and broadcast them via Infura. If the scripts exit because your account isn't funded, you can request funds on https://sepoliafaucet.com/ or https://faucet.paradigm.xyz/.

#### Viem

```bash
$ pnpm start-viem
```

This script will do the following:

1. instantiate a Turnkey Viem wallet client
2. instantiate a Viem public client (to be used to fetch onchain data)
3. connect the wallet client to the Biconomy paymaster
4. send ETH (via type 2 EIP-1559 transaction)

See the following for a sample output:

```
Network:
        sepolia (chain ID 11155111)

Signer address:
        0xDC608F098255C89B36da905D9132A9Ee3DD266D9

Smart wallet address:
        0x7fDD1569812a168fe4B6637943BD36ec2c836A6A

Balance:
        0.0499994 Ether

Transaction count:
        1

Nonce:
        9

✔ Amount to send (wei). Default to 0.0000001 ETH … 100000000000
✔ Destination address (default to TKHQ warchest) … 0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7
Sent 0.0000001 Ether to 0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7:
        https://sepolia.etherscan.io/tx/0x2f2d996d6b262ebf0263b432ca3e6d621ba42d60b92344f31cf3ed94d09f49c4

User Ops can be found here:
        https://v2.jiffyscan.xyz/tx/0x2f2d996d6b262ebf0263b432ca3e6d621ba42d60b92344f31cf3ed94d09f49c4?network=sepolia&pageNo=0&pageSize=10
```

#### Viem + Nexus

```bash
$ pnpm start-viem-nexus
```

This script will do the following:

1. instantiate a Turnkey Viem wallet client
2. instantiate a Viem public client (to be used to fetch onchain data)
3. connect the wallet client to Biconomy Nexus
4. send ETH (via type 2 EIP-1559 transaction)

Note: this script must be used specifically with Base's Sepolia testnet.

See the following for a sample output:

Network:
base-sepolia (chain ID 84532)

Signer address:
0xDC608F098255C89B36da905D9132A9Ee3DD266D9

Smart wallet address:
0xC00f5dCe7E266553cb3FBCd0BeDD11e290D551Fd

Balance:
0.009998258337028736 Ether

Transaction count:
1

Nonce:
106650284489225899116705470776299986053547585411730459514530106938958242906112

✔ Amount to send (wei). Default to 0.0000001 ETH … 100000000000
✔ Destination address (default to TKHQ warchest) … 0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7
Sent 0.0000001 Ether to 0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7:
https://sepolia.basescan.org/tx/0x453781ffcf1b4f5f98952347bcef14a0e7d6cbf7f9992b2a31163f67278625c6

User Ops can be found here:
https://v2.jiffyscan.xyz/tx/0x453781ffcf1b4f5f98952347bcef14a0e7d6cbf7f9992b2a31163f67278625c6?network=base-sepolia&pageNo=0&pageSize=10

#### Ethers

```bash
$ pnpm start-ethers
```

This script will do the following:

1. instantiate a Turnkey Ethers wallet client
2. instantiate a Ethers provider (to be used to fetch onchain data)
3. connect the wallet client to the Biconomy paymaster
4. send ETH (via type 2 EIP-1559 transaction)

See the following for a sample output:

```
Network:
        sepolia (chain ID 11155111)

Signer address:
        0xDC608F098255C89B36da905D9132A9Ee3DD266D9

Smart wallet address:
        0x7fDD1569812a168fe4B6637943BD36ec2c836A6A

Balance:
        0.0499993 Ether

Transaction count:
        1

Nonce:
        10

✔ Amount to send (wei). Default to 0.0000001 ETH … 100000000000
✔ Destination address (default to TKHQ warchest) … 0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7
Sent 0.0000001 Ether to 0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7:
        https://sepolia.etherscan.io/tx/0x0f0d5346ba726f7ccf80142ae295f28bf3873b0aeb7b29488b1e3dfb949d5ba6

User Ops can be found here:
        https://v2.jiffyscan.xyz/tx/0x0f0d5346ba726f7ccf80142ae295f28bf3873b0aeb7b29488b1e3dfb949d5ba6?network=sepolia&pageNo=0&pageSize=10
```
