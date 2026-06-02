# Example: `with-gnosis`

This example shows how to create new Ethereum addresses via Turnkey, configure a 3/3 Gnosis safe, and create, sign, and execute a transaction from it.

## NOTE:

The typescript check has been removed from this example temporarily. This is due to a patch requiring `web3, web3-core, web3-util >= 4.2.1`. However, the latest version of Protocol Kit (`@safe-global/protocol-kit`) is 3.0.1, which has nested dependencies that expect `EventLog`, which no longer exists in `web3-core`.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-gnosis/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- Three wallet account addresses, private key addresses, or private keys

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `SIGN_WITH_1 / 2 / 3` -- 3 Turnkey wallet account addresses, private key addresses, or private key IDs. If you leave any of these blank, we'll create a wallet with 3 wallet accounts for you.
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
- If you try to run the script multiple times, you may run into a `CREATE2` issue. This is due to deployed Safe contract addresses being deterministic. In such cases, consider connecting to an existing Safe via `const safeSdk: Safe = await Safe.create({ ethAdapter: ethAdapterOwner1, safeAddress })`.
- For this example, we recommend the usage of Sepolia + Infura specifically: we've experienced more consistent performance for this example on Sepolia.
  See the following for a sample output:

```
Address:
        0x1Bce4a8De35Cf22aCaA4D167C722dD80C14Eb0Ee

Balance:
        0.017970393967449568 Ether

Transaction count:
        26

Address:
        0xf285510B55f62d6787399409418590c9B6d246Fe

Balance:
        0.02460411999815256 Ether

Transaction count:
        5

Address:
        0xE69b8ede844DB94fe726Cf2537992e61A6a6Ea2e

Balance:
        0.02351972499309205 Ether

Transaction count:
        14

New Gnosis Safe Address:
        0x12AB2c1187e5a96b810CaefEa79129E47c35F0f3

Sent 0.00001 Ether to 0x12AB2c1187e5a96b810CaefEa79129E47c35F0f3:
        https://sepolia.etherscan.io/tx/0x3bc34a581ed2d1ce268ba3c631e0af00b6d54014c5801b3b7d19453fcf571ae2

Signed transaction offchain using signer 1. Signature:
        0xb71f002a9328b50169cfd8c4d8a03abb307d488e8c0de0455b0999961d6768b3005860f457c25420d1bb993cb0b60d8c07862e6e39d9953a6a2d44da2fd172261c

Signed transaction hash offchain using signer 2. Signature:
        0x66bf410d0a8a219989cf89a8dbb0adcad66a4764576f0c0a125b50a024ab00974f0c232e42feccb61890186bf22db111481b6f5bb9ebc4c0b95f65795353235720

Approved transaction onchain using signer 3. Etherscan link:
        https://sepolia.etherscan.io/tx/0xe15f9caaa02ea214baac614b86c5db32e556d8ca043060a3f7cf4a899cf81852

Executed transaction. Etherscan link:
        https://sepolia.etherscan.io/tx/0x78c7af3fe9f69f616b486b0c6058fefe208ab3c00596c519907a139c78157f92
```
