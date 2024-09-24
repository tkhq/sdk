# Example: `with-bitcoin`

This example shows how to construct, sign, and broadcast a Bitcoin transaction using Turnkey.

| Status | Format |
| ------ | ------ |
| 🚧     | P2PKH  |
| 🚧     | P2TR   |
| 🚧     | P2WSH  |
| ✅     | P2SH   |
| ✅     | P2WPKH |

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v16+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-bitcoin/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- A Turnkey wallet account (address), private key address, or a private key ID. For Bitcoin addresses, you should create one with the address format `COMPRESSED`.

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `SIGN_WITH_COMPRESSED` -- a Turnkey wallet account address, private key address, or private key ID. If you leave this blank, we'll create a wallet for you.

### 3/ Running the scripts

Some implementation notes:

- Default to using Bech32 addresses
- Use testnet3 (though testnet4 is coming soon!)
- Faucet funds:
  - Testnet3: https://coinfaucet.eu/en/btc-testnet/, https://bitcoinfaucet.uo1.net/
  - Testnet4: https://mempool.space/testnet4/faucet

There are multiple scripts included. See `package.json` for all of them. The following is the default:

```bash
$ pnpm start
```

This script will do the following:

1. Create a new BTC wallet (if necessary)
2. Prompt the user for a transaction amount and destination
3. Do some UTXO math to perform (very very naive) coin selection
4. Optional: Broadcast the transaction \*\* : this is fragile. I would recommend broadcasting via https://live.blockcypher.com/pushtx (select the `Bitcoin Testnet` option), as it's the most permissive and allows for very small transaction amounts (i.e. dust).

For the sake of example, we utilize three different, prominent Bitcoin API providers: Blockstream, Mempool, and BlockCypher.

Example output:

```
✔ Amount (in satoshis) … 1
✔ Destination BTC address, starting with tb1 (Bech32 testnet pubkey hash or script hash) … tb1q7acq9r6pzskjzn822uvfmgxqm0728wawqxx2z9

02000000000101024ef0e2a6a0b2ff47363b6fd45cc57e82d4cc6fedc49a7c4b849f6e0772788e0200000000ffffffff020100000000000000160014f770028f41142d214cea57189da0c0dbfca3bbae5811000000000000160014f770028f41142d214cea57189da0c0dbfca3bbae02483045022100b74ed137d0e8681c049dc9304717ad12278c721eaef73780465bd84e3735f553022010c0839b953da57a504b957d4821bf4acde6c066846adcc0867a54f1d9bf8ab601210393c8e4065aca474ec8e8e4562a063f57e5b5e6b0aa316d43cec42fbb8d5b324d00000000
```

We also have another script specifically to derive a BTC address given a compressed public key:

```bash
$ pnpm derive
```

Example output:

```
✔ Generic public key (hex-encoded, starts with 04, 66 characters long) … 0393c8e4065aca474ec8e8e4562a063f57e5b5e6b0aa316d43cec42fbb8d5b324d
Testnet P2WPKH address: tb1q7acq9r6pzskjzn822uvfmgxqm0728wawqxx2z9
```

### Other

Remaining TODOs:

- Remove usage of ECPair in favor of Bech32 libraries
- Transaction replacement: RBF, CPFP
