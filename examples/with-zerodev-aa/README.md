# Example: `with-zerodev-aa`

This example shows how to construct and broadcast a transaction using Turnkey with [`Ethers`](https://docs.ethers.org/v6/api/providers/#Signer) (WIP), [`Viem`](https://viem.sh/docs/clients/wallet.html), and [`Zerodev`](https://docs.zerodev.app/sdk/getting-started/quickstart).

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
$ cd examples/with-zerodev-aa/
```

### 2a/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- A Turnkey wallet account (address), private key address, or a private key ID

### 2b/ Setting up Zerodev

The next step is to navigate to Zerodev to create an account. Visit the [Zerodev Dashboard](https://dashboard.zerodev.app/) to create a your paymaster and find the following:

- Bundler RPC
- Paymaster RPC

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
- `ZERODEV_BUNDLER_RPC`
- `ZERODEV_PAYMASTER_RPC`

### 3/ Running the scripts

Note: there are two included — one for Viem and another for Ethers (WIP). See `package.json` for more details.

These scripts construct transactions via Turnkey and broadcast them via Infura. If the scripts exit because your account isn't funded, you can request funds on https://sepoliafaucet.com/ or https://faucet.paradigm.xyz/.

#### Viem

```bash
$ pnpm start-viem
```

This script will do the following:

1. instantiate a Turnkey Viem wallet client
2. instantiate a Viem public client (to be used to fetch onchain data)
3. create a Zerodev Kernel Client (with Paymaster support)
4. create a Zerodev Bundler Client
5. send ETH (via type 2 EIP-1559 transaction)

See the following for a sample output:

```
Network:
        sepolia (chain ID 11155111)

Signer address:
        0xbcb87Df08A6a4409B28a85Af41f32Da75bD442e9

Smart wallet address:
        0xDbf9297467030aFf40E0D9cd43D088696596B841

Balance:
        0.0099995 Ether

Transaction count:
        1

Nonce:
        913479994650515257524606220465835134743662536739504622017003723935449093

✔ Amount to send (wei). Default to 0.0000001 ETH … 100000000000
✔ Destination address (default to TKHQ warchest) … 0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7
Sent 0.0000001 Ether to 0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7:
        https://sepolia.etherscan.io/tx/0xe70fd04de98bc47595fba282f172ff0fa75949a7b0e16647cf423e8db7fb9ed1

Bundle can be found here:
        https://jiffyscan.xyz/bundle/0xe70fd04de98bc47595fba282f172ff0fa75949a7b0e16647cf423e8db7fb9ed1?network=sepolia&pageNo=0&pageSize=10

User Ops can be found here:
        https://jiffyscan.xyz/userOpHash/0xe70fd04de98bc47595fba282f172ff0fa75949a7b0e16647cf423e8db7fb9ed1?network=sepolia&pageNo=0&pageSize=10
```

#### Ethers

🚧 WIP! Come back soon🔜
