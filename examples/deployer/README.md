# Example: `deployer`

This example shows how to deploy a smart contract using [`Ethers`](https://docs.ethers.org/v6/api/providers/#Signer) with Turnkey.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/deployer/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- A (crypto) private key ID

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `PRIVATE_KEY_ID` -- if you leave it blank, we'll create one for you via calling the Turnkey API
- `INFURA_KEY` -- if this is not set, it will default to using the Community Infura key

### 3/ Running the scripts

```bash
$ pnpm start
```

This script will do the following:

1. Compile the contract specified in `compile.ts`
2. Deploy the contract via Turnkey signer

Notes:

- To _only_ compile, run `pnpm compile`
- If you prefer to use `solc/solcjs` via CLI, generate the ABI and binary files, and import them in `index.ts` via something resembling the following:

```typescript
const abi = require("<some-abi.json>");
const bytecode = fs.readFileSync("<some-compiled-contract.bin>").toString();
```

Sample output:

```
Network:
        goerli (chain ID 5)

Address:
        0x2A5111A1b0c0da37750b595b89BBaf1E6B7a8a27

Balance:
        0.090843405342321879 Ether

Contract address
        0xaaCADe99B5D2638534d7E6F6b6635005752D65fb

Contract has been deployed:
        https://goerli.etherscan.io/tx/0x86eca7a545c6128923c77f321ca4b5a9ed66925ed223f6577dca73b9b8ea13f9
```
