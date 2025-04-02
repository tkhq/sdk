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

### 2b/ Setting up ZeroDev

The next step is to navigate to ZeroDev to create an account. Visit the [ZeroDev Dashboard](https://dashboard.zerodev.app/) to create a paymaster and find your bundler RPC. You can find more details on the tutorial page here: https://docs.zerodev.app/sdk/getting-started/tutorial.

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
- `ZERODEV_RPC`

### 3/ Running the scripts

Note: only Viem is supported in this example at this time. Ethers is currently a WIP.

These scripts construct transactions via Turnkey and broadcast them via Infura. If the scripts exit because your account isn't funded, you can request funds on https://sepoliafaucet.com/, via Coinbase Wallet, etc.

#### Viem

```bash
$ pnpm start-viem
```

This script will do the following:

1. instantiate a Turnkey Viem wallet client
2. instantiate a Viem public client (to be used to fetch onchain data)
3. create a ZeroDev Validator
4. create a ZeroDev Kernel Client (with Paymaster support)
5. send a UserOp to mint an NFT

See the following for a sample output:

```
My account:
        0x71799300bc4b2F16a1377E119169543B3D3Da382

Submitted UserOp:
        0x5bda54f67d2d5fe51f5d5950c6ea66cdf9e7fd071bc2f61db6bedec2d442e4fa

UserOp confirmed:
        https://v2.jiffyscan.xyz/userOpHash/0x5bda54f67d2d5fe51f5d5950c6ea66cdf9e7fd071bc2f61db6bedec2d442e4fa?network=sepolia&section=overview

TxHash:
        https://sepolia.etherscan.io/tx/0xe9e1cbf4e6c1b88a3725585e408616a906114ad7b1b52d40c46fb3bef2adf684

NFT balance:
        3
```

#### Ethers

🚧 WIP! Come back soon🔜
