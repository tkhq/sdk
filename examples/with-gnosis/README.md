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
- Three (crypto) private key IDs

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

- If the script exits because your account isn't funded, you can request funds via https://sepoliafaucet.com/ or Coinbase Wallet (developer settings).
- Transactions will all be broadcasted sequentially.
- For this example, we recommend the usage of Sepolia + Infura specifically: we've experienced more consistent performance for this example on Sepolia, which is not supported by the Alchemy provider in Ethers v5.

See the following for a sample output:

```
Address 1:
        0x1Bce4a8De35Cf22aCaA4D167C722dD80C14Eb0Ee

Balance 1:
        0.018938199472224931 Ether

Transaction count 1:
        23

Address 2:
        0xf285510B55f62d6787399409418590c9B6d246Fe

Balance 2:
        0.02460411999815256 Ether

Transaction count 2:
        5

Address 3:
        0xE69b8ede844DB94fe726Cf2537992e61A6a6Ea2e

Balance 3:
        0.023741618494127553 Ether

Transaction count 3:
        12

New Gnosis Safe Address:
        0x10737C16995cBA89B7E2F880e21B18A0baccB9D4

Sent 0.00001 Ether to 0x10737C16995cBA89B7E2F880e21B18A0baccB9D4:
        https://sepolia.etherscan.io/tx/0xa631252ddd12186289328bfb2d1df1dad6c1682643a2aacc1e2596cec301b492

Signed transaction offchain using signer 1. Signature:
        0x124781badec42f95994c7b1896a7d61c6f3efeaae181d80ab2681911c2b0490f5b89d18e8604c79a1103869586f277fae49be8414e653503b5eaed6a4957c88e1b

Signed transaction hash offchain using signer 2. Signature:
        0x5d532ad0bfd638e785786d936f6dd41ad87e04245215b5278cff1d17cb1f81773bcc3c1926b6b0619b191c0e7f0a510cee03185f059d72a81d831b6ac849e2d21f

Approved transaction onchain using signer 3. Etherscan link:
        https://sepolia.etherscan.io/tx/0x72871b1e3cc1862ea12adb793d061a0c45ac6324e0d95bffae88f0ebeead0c30

Executed transaction using signer 3. Etherscan link:
        https://sepolia.etherscan.io/tx/0xcc6dafb34b950fd3a38d741c8a93c1612b1026a1dff39632aa2665195a5afda8
```
