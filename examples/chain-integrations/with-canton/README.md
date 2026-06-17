# Example: `with-canton`

This example shows how to construct, sign, and broadcast a Canton transaction using Turnkey.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` and `Docker` installed locally; we recommend using Node v24+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install  # Install dependencies
$ pnpm build --filter=./examples/chain-integrations/with-canton # Compile source code
$ cd examples/chain-integrations/with-canton/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID

Once you've gathered these values, add them to a new `.env` file for future reference. See [./.env.example](./.env.example) for a template. Notice that your private key should be securely managed and **_never_** be committed to git.

### 3/ Setting up a local Canton network

The example runs against a local Canton network created using `dpm sandbox`. The easiest way of spinning it up is using `docker compose`:

```sh
# Either
pnpm sandbox

# Or directly docker compose up sandbox
```

### 3/ Running the tests

The example flow is provided as a [`jest` test](examples/chain-integrations/with-canton/src/__tests__/signing.test.ts).

The test will:

- Create a new wallet under your Turnkey account called `Canton E2E Wallet - Alice`
- Setup Canton topology
  - Create a new party
  - Create a new user
- Upload & deploy an example Canton contract
- Prepare & execute a `Create` command on the example contract, showcasing both `v2` and `v3` transactions

The test also uses TypeScript code for encoding & hashing the prepared transactions, based on [Canton documentation](https://docs.digitalasset.com/build/3.5/explanations/external-signing/external_signing_hashing_algorithm.html). At the moment, we don't provide this code in an NPM package that you can conveniently install.