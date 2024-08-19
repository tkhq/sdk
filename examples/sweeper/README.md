# Example: `sweeper`

This example shows how to sweep funds (tokens + native ETH) from one address to another, built on top of [`Ethers`](https://docs.ethers.org/v6/api/providers/#Signer) with Turnkey.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/sweeper/
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

### 3/ Running the script

```bash
$ pnpm start
```

The script constructs and signs a series of sweep transactions via Turnkey, and broadcasts via Infura. If the script exits because your account isn't funded, you can request funds on https://goerlifaucet.com/. By default, this utility will sweep USDC, UNI, WETH, and ETH. To add any additional tokens, see `utils.ts`.

NOTE: in this script, we wait for 1 block confirmation per transfer. Feel free to customize as you please.

```
Network:
        goerli (chain ID 5)

Address:
        0x2A5111A1b0c0da37750b595b89BBaf1E6B7a8a27

Balance:
        0.094678708129562482 Ether

✔ Please confirm: transfer 0.05 UNI (token address 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984) to 0x4A7937B14bb850bd706053e279Db9D9a784A1eF2? … yes
Sent 0.05 UNI (token address 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984) to 0x4A7937B14bb850bd706053e279Db9D9a784A1eF2:
        https://goerli.etherscan.io/tx/0x60849266677a53ea2f3eb2ea301d1cd2625c273e84eeec60cce6fbd4c50ab94e

✔ Please confirm: transfer 5.0 USDC (token address 0x07865c6E87B9F70255377e024ace6630C1Eaa37F) to 0x4A7937B14bb850bd706053e279Db9D9a784A1eF2? … yes
Sent 5.0 USDC (token address 0x07865c6E87B9F70255377e024ace6630C1Eaa37F) to 0x4A7937B14bb850bd706053e279Db9D9a784A1eF2:
        https://goerli.etherscan.io/tx/0xbbbe9211db006aa275bd85c8238f5050d53f884f9bbb51fa4b199d9f16259e2d

✔ Please confirm: transfer 0.0698606968 ETH (balance of 0.0780434300 - 0.0081827332 for gas) to 0x4A7937B14bb850bd706053e279Db9D9a784A1eF2? … yes
Sent 0.0698606968 ETH to 0x4A7937B14bb850bd706053e279Db9D9a784A1eF2:
        https://goerli.etherscan.io/tx/0xff4fe9587fbdf167c43641dae16ee0e250ee0fe794da94c8d8500ca5964168ba
```
