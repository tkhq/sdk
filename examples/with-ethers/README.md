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
- A (crypto) key ID

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `KEY_ID` -- if you leave it blank, we'll create one for you via calling the Turnkey API

### 3/ Running the script

```bash
$ pnpm start
```

The script constructs a transaction via Turnkey and broadcasts via Infura. If the script exits because your account isn't funded, you can request funds on https://goerlifaucet.com/.

Visit the Etherscan link to view your transaction; you have successfully sent your first transaction with Turnkey!

```
Network
	goerli (chain ID 5)
Address
	0xD05925Ee065179963842cC5DAD63C545177dA5A9
Balance
	161369999979147000
Transaction count
	20
Signed transaction
	0x02f8678080808080942ad9ea1e677949a536a270cec812d6e868c8810887038d7ea4c6800080c001a0d11db1eada99e65e1d823e32368a8fa6d2b4ecc9106927c624096b35d83a0b93a0751e5d34ef8462da687cdc5500fb585e828079032c919f200501b0e8a1c383db
Transaction sent!
	https://goerli.etherscan.io/tx/0x9e28260b134e46551f324ce91094ae181e8850a65508a85d1704f2993e7e5574
```
