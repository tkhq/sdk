# Example: `with-solana`

This example walks through the following:

- Creation of a new Turnkey wallet with a new Solana account
- Monitoring of devnet tokens landing on that address
- Construction of a transaction sending the funds out with the `@turnkey/solana` signer
- Creating, minting, and transferring a SPL token using Turnkey

You can try this example quickly on Stackblitz. Follow the instructions below --> [Stackblitz Instructions](#6-stackblitz-example)

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-solana/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`

You can specify an existing Turnkey Solana address if you have one already:

```
SOLANA_ADDRESS=<your Turnkey Solana address>
```

Note that this is optional: the script gives you a fresh one if you don't specify one in your `.env.local` file.

### 3/ Running the script

```bash
$ pnpm start
```

You should see output similar to the following:

```
creating a new Solana wallet in your Turnkey organization...

New Solana wallet created!
- Name: Solana Wallet 6527
- Wallet ID: 7f0f7d49-22e3-5b34-8192-db3df83a0759
- Solana address: G6fEj2pt4YYAxLS8JAsY5BL6hea7Fpe8Xyqscg2e7pgp

Your new Solana address: "G6fEj2pt4YYAxLS8JAsY5BL6hea7Fpe8Xyqscg2e7pgp"

💸 Your onchain balance is at 0! To continue this demo you'll need devnet funds! You can use:
- The faucet in this example: `pnpm run faucet`
- The official Solana CLI: `solana airdrop 1 G6fEj2pt4YYAxLS8JAsY5BL6hea7Fpe8Xyqscg2e7pgp`
- Any online faucet (e.g. https://faucet.solana.com/)

To check your balance: https://explorer.solana.com/address/G6fEj2pt4YYAxLS8JAsY5BL6hea7Fpe8Xyqscg2e7pgp?cluster=devnet

--------
Using existing Solana address from ENV: "G6fEj2pt4YYAxLS8JAsY5BL6hea7Fpe8Xyqscg2e7pgp"
? Destination address: tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C
? Amount (in Lamports) to send to tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C: 100

Turnkey-powered signature:
        4W4X5wVzpPhCHQ8LeR18icfUYs7FdHQ6uTfkQ7E6jciuv9NQ6pZnyYj2veaeZoD5co3nz1gzBdZ2v6c4LXLjiTBm

Transaction broadcast and confirmed! 🎉
        https://explorer.solana.com/tx/3Wr1vmSwqf7jPJXzgqA3fGfELdTfiR8v86sRiTJxNYT4KYEcadQjceFsN8BoHQZqb6mnuqsJsgHdk6i8Sj8YtmVr?cluster=devnet
```

Note: if you have a consensus-related policy resembling the following

```
{
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.count() >= 2"
}
```

then the script will await consensus to be met. Specifically, the script will attempt to poll for activity completion per the `activityPoller` config passed to the `TurnkeyServerSDK`. If consensus still isn't met during this period, then the resulting `Consensus Needed` error will be caught, and the script will prompt the user to indicate when consensus has been met. At that point, the script will continue.

### 4/ Running the advanced script (multiple versioned transactions)

```bash
$ pnpm advanced
```

The output will resemble the following:

```
Using existing Solana address from ENV: "G6fEj2pt4YYAxLS8JAsY5BL6hea7Fpe8Xyqscg2e7pgp"
? Number of transactions: 3
? 1. Destination address: tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C
? 1. Amount (in Lamports) to send to tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C: 111

? 2. Destination address: tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C
? 2. Amount (in Lamports) to send to tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C: 222

? 3. Destination address: tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C
? 3. Amount (in Lamports) to send to tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C: 333

Transaction broadcast and confirmed! 🎉
        https://explorer.solana.com/tx/4takozf5EcfzhPwxNfUxgY8wSUmhj7uLfzoQUJSND13wK4P2yQEZSfhEdHELyRZ1ZrPFcHBSAscQBtfwcY6FvB5t?cluster=devnet

Transaction broadcast and confirmed! 🎉
        https://explorer.solana.com/tx/4wjQuxEKRw5Pq3TKWj7cTqg12FryhGsBN4zUrz49vDeRQnkAVGKnZFEP5ka8Zs2RxrdNyRACBCBjs63fKnQGoGve?cluster=devnet

Transaction broadcast and confirmed! 🎉
        https://explorer.solana.com/tx/32jEdshTKFh14xrdkgVBp3TXcdXsswshtt2GozLtz7bauYeuwfDfChrHW9G5GDU5H7Q8FxpjKpokAoH39jiGUDAC?cluster=devnet
```

### 5/ Running the SPL token script (create, mint, transfer)

```bash
$ pnpm token-transfer
```

The output will resemble the following:

```
Using existing Solana address from ENV: "G6fEj2pt4YYAxLS8JAsY5BL6hea7Fpe8Xyqscg2e7pgp"
Broadcasting token creation transaction...
Transaction broadcast and confirmed! 🎉
        https://explorer.solana.com/tx/5Ed39grpEMRQDxs1JLCq1U4P12zfohtqBwWLkKiHtU3e9avsG2hHnrTNmc7EiAhhAQFNkN3dbAEoPqpdxgvqKDhY?cluster=devnet

Broadcasting token account creation transaction...
Transaction broadcast and confirmed! 🎉
        https://explorer.solana.com/tx/64VTfNsRbfN6bvRMkyg8YNpARfN15pgCCHWMiTXwJ8obfhoCh8LzdcSJZ3RaYWPdZSyhzcuMuBEH6dwEVTykSN9m?cluster=devnet

Broadcasting token account creation transaction...
Transaction broadcast and confirmed! 🎉
        https://explorer.solana.com/tx/3oDJT16zPsT13abdpY4wHYDB8H7c3siALTgsNU1FT8FdXJUM1a1TLYGtvpugA22oPc9oAugVUJ9GkXazBTDa4ozQ?cluster=devnet

Broadcasting mint transaction...
Transaction broadcast and confirmed! 🎉
        https://explorer.solana.com/tx/3EMEqrJb6jdcHcdBtd5Ye25ZDRrqJ65fbVyqa7DZ3J83dNL5jHfurQDNBZSmmkQdChymhUSdtkVSwThn6avBuN7L?cluster=devnet

Broadcasting token transfer transaction...
Transaction broadcast and confirmed! 🎉
        https://explorer.solana.com/tx/38UkmrZztX4DB1mCi1i3GfYHjUFz3iB1S9dwexVBEzSvgEshEV3aUxrmNjWzToYjjKXnKDBv1tRWXpK1JhU3MFoB?cluster=devnet

Token balance for user: 0.9999
Token balance for warchest: 0.0001
```

Enjoy!

### 6/ Stackblitz Example

Example Link: https://stackblitz.com/edit/stackblitz-starters-xeb93i

#### Prerequisites

To use the example you need the following

- Turnkey Organization
- API key for the root user (both public and private key needed)

#### Set Env Variables

Set the following environment variables in the `.env.local` file

- `API_PUBLIC_KEY` --> Set this to be the public key of the API key for the root user for the org you've created
- `API_PRIVATE_KEY` --> Set this to be the private key of the API key for the root user for the org you've created
- `ORGANIZATION_ID` --> Set this to be the Org ID of the org you've created

#### Optional Env Variables

- `SOLANA_ADDRESS` --> This is optional, If you want to use an existing Solana address in your organization, put it here!
- `SOLANA_ADDRESS_FEE_PAYER` --> This is optional, a separate fee payer address. To be used in `withFeePayer.ts`

#### Directions to use

- run `npm install && npm start`
