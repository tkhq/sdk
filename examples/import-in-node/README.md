# Example: `import-in-node`

This example demonstrates the following:

- Programmatic import of a private key or wallet into your Turnkey organization
- Verification of enclave signature during import
- Encryption of sensitive data using HPKE (Hybrid Public Key Encryption)

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/import-in-node/
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

### 3/ Running the script

```bash
$ pnpm start
```

You should see output similar to the following:

```
Enter Import Type, either wallet or key:
```

If you select "wallet," you'll be asked to enter a mnemonic seed phrase, and the wallet will be imported.
If you select "key," you'll be asked to enter a private key and its format (either HEXADECIMAL or SOLANA), and the private key will be imported.
