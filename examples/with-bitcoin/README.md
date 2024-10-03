# Example: `with-bitcoin`

This example shows how to construct, sign, and broadcast a Bitcoin transaction using Turnkey. This example is compatible with P2TR and P2WPKH

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
- Two Turnkey wallet addresses:
  - one with `COMPRESSED` format (in `SOURCE_COMPRESSED_PUBLIC_KEY`)
  - one in either `P2TR` or `P2WPKH` (in `SOURCE_BITCOIN_ADDRESS`)
  - you can create a wallet with `pnpm run create-wallet` if you do not have one already

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `SOURCE_COMPRESSED_PUBLIC_KEY`: Turnkey wallet address (`COMPRESSED` format)
- `SOURCE_BITCOIN_ADDRESS`: Turnkey wallet address (`P2TR` or `P2WPKH` format)

### 3/ Running the scripts

You can create a new Bitcoin wallet through the turnkey dashboard or via a convenience script we provide:

```bash
$ pnpm run create-wallet
> @turnkey/example-with-bitcoin@0.1.0 create-wallet
> tsx src/createNewWallet

✔ Name your new wallet … CLI wallet
✔ Select the type of wallet you would like to create › P2TR (testnet)

New Bitcoin wallet created!
- Name: CLI wallet
- Wallet ID: df09819b-acf1-5d0c-a639-98cc01c66487
- Public key: 035e2cbb6cdcdd8695b72756ed03104d7ae789283f36a217c6a0e498a7f9044e04
- Address: tb1pjuldrxzva9ajfskqs2hvmqkpa282w755c7sr4pg48xn2gwkf82esusy7z9

Now you can populate your `.env.local` with:
SOURCE_COMPRESSED_PUBLIC_KEY="035e2cbb6cdcdd8695b72756ed03104d7ae789283f36a217c6a0e498a7f9044e04"
SOURCE_BITCOIN_ADDRESS="tb1pjuldrxzva9ajfskqs2hvmqkpa282w755c7sr4pg48xn2gwkf82esusy7z9"
```

If you are using testnet you will need to obtain funds in your address to send it. Known faucets:

- Testnet3: https://coinfaucet.eu/en/btc-testnet/, https://bitcoinfaucet.uo1.net/
- Testnet4: https://mempool.space/testnet4/faucet

```bash
$ pnpm start
```

This script will do the following:

1. Verify that the provided public key and address are related to each other
2. Fetch the available UTXOs on the source address
3. Prompt the user for the UTXOs to spend and an amount
4. Do some basic math to compute fees and change output
5. Output the transaction

For the sake of example, we utilize two API providers: Mempool for fee rates, Blockstream to fetch UTXOs (indexing).

Example output:

```
✅ Loaded configuration
-> Source address: tb1qa6dqr8fkh34supp8gv4ges8y0pa8yeweffjf84
-> Inferred address type: TestnetP2WPKH
Fetching UTXOs...
✔ select UTXOS to spend › 11852 sats (tx # 0e5423d80d522d499d1379ec01b87eee36cec096c8b740fd5a9c128b2c810700 @ 0)
✔ Destination BTC address … tb1phgfu8789qvd78mdxwdf84ak20yhvw79yv67r4dpe0z4z876wwyesetl7yz
✅ Fee estimate: 180 sats
✔ How much to you want to send to tb1phgfu8789qvd78mdxwdf84ak20yhvw79yv67r4dpe0z4z876wwyesetl7yz? (max: 11672 sats, the rest will go back to the source address as change) … 3000
✔ change amount going back to your source address will be 8672. Looks good? … yes
✅ Transaction signed! To broadcast it, copy and paste the hex payload to https://mempool.space/testnet/tx/push
020000000001010007812c8b129c5afd40b7c896c0ce36ee7eb801ec79139d492d520dd823540e0000000000ffffffff02b80b000000000000225120ba13c3f8e5031be3eda673527af6ca792ec778a466bc3ab43978aa23fb4e7133e021000000000000160014ee9a019d36bc6b0e0427432a8cc0e4787a7265d902483045022100ba2189eb309bd9c1e417c50bd30e77b76faf565dd5b0f987bb991bb44312adf502200d15292e21380984a1d3cd4ad203ac1bcb632bdd0d3772eaf6f532dce53c8ca30121036f9d88ee0cceaffb044b1c113bbe6e48e8660fb6ef731d267c8ce7e3df8c10c700000000
```

([link to onchain tx](https://mempool.space/testnet/tx/6bcd8e6f7a88a26d6da28ce426c8cde628ce13408ca53a576be6304920d62cbf))

### Other

Remaining TODOs:

- Remove usage of ECPair in favor of Bech32 libraries
- Transaction replacement: RBF, CPFP
