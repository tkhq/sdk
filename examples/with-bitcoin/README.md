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

### 4/ Running the policy-enabled Bitcoin transaction signing example

```bash
$ pnpm with-policy
```

Documentation on our Bitcoin policy engine, and policy-enabled Bitcoin transaction signing can be found here: https://docs.turnkey.com/networks/bitcoin#policy-enabled-bitcoin-transaction-signing

To use our policy-enabled Bitcoin transaction signing flow, this example will use the `SIGN_TRANSACTION` endpoint with the transaction type `TRANSACTION_TYPE_BITCOIN`, and will pass in a hex serialized PSBT (Partially Signed Bitcoin Transaction).

The script shares code with our other signing flow described in the section above, and will perform the same validation and prompting as above to create the Bitcoin transaction.

Following that it will perform the following actions:

1. Policy creation: script will prompt the user to enter an address to allowlist as a receiving address, which it will then use to create a policy in the organization being used.
2. Non-root user creation: script will create a non-root user to apply policies to
3. Policy enabled transaction signing: script will ATTEMPT to sign the transaction using the policy enabled endpoint as described above. If the address that was used to create the allowlist policy is the SAME as the receiving address you entered while creating the transaction, signing will SUCCEED, if not it will FAIL.

```
✔ Enter receiving address to ALLOW signing via policy (to test failure case, enter something other than the receiving address that you entered while creating your PSBT): … tb1pdfxxeq5z7r2amexl7wj4e9jeng5u2p3ekv23x2m3qc2p3sqkducqfms7nm
New policy created!
- Name: Bitcoin allow transfer to 'tb1pdfxxeq5z7r2amexl7wj4e9jeng5u2p3ekv23x2m3qc2p3sqkducqfms7nm'
- Policy ID: 852725d1-15a9-4af1-8ea5-66f24f1bb666
- Effect: EFFECT_ALLOW
- Consensus: approvers.count() == 1
- Condition: bitcoin.tx.outputs.count() == 2 && bitcoin.tx.outputs.all(o, o.address in ['tb1pdfxxeq5z7r2amexl7wj4e9jeng5u2p3ekv23x2m3qc2p3sqkducqfms7nm','tb1qeln8v9chnchymmmgmad374z3qz598y3mahz7ws'])

New user created!
- Name: new-bitcoin-user
- User ID: 61eec25f-78be-4e6b-9fe3-5f73af2218e1

✅ Transaction signed! To broadcast it, copy and paste the hex payload to https://mempool.space/testnet/tx/push
0200000000010103a36b6f950ad4b77e8d6a5d4fa08adc7e509c3858d936af38bf9a3350a610b70000000000ffffffff02cf070000000000002251206a4c6c8282f0d5dde4dff3a55c96599a29c50639b315132b71061418c0166f308a99020000000000160014cfe67617179e2e4def68df5b1f545100a853923b02473044022050b3a21d8f6aeb5842f16dfe757c14f7d315067571d5e1d424c24279ffa2d14e022046b332141f4ae2e153edb80025e54da29730f96700ae4eeb4ab8f717a9b9369d012102c0a83fe6de4965f39b6c3e200d0054b29e3ebeeb9c1c5bb4c6ca8e9cf7c33db600000000
```

### Other

Remaining TODOs:

- Remove usage of ECPair in favor of Bech32 libraries
- Transaction replacement: RBF, CPFP
