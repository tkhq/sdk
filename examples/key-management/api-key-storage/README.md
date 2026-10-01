# Example: `api-key-storage`

This example demonstrates programmatic API key storage with Turnkey secrets, following the [API key storage](https://docs.turnkey.com/solutions/key-management/api-key-storage) solution:

- Creating a trading service user with its own API key
- Importing an API key as a secret, with policy-visible static properties bound at import time
- Creating a policy that scopes retrieval of trade-only exchange keys to that service user
- Listing the organization's secrets (metadata only)
- Retrieving the plaintext at runtime with `exportSecret`, as the service user
- Retrieving several plaintexts at once with `exportSecretsAndDecrypt`, attaching per-secret `requestContext` claims for audit. Exports run as activities of at most 32 secrets, and authorization is all-or-nothing per activity. If any activity fails, no plaintext is returned, even if earlier activities completed. Decryption keys exist only in memory, so plaintext cannot be recovered after an error.

For a multi-party retrieval flow where two agents approve the same export in parallel, see the [`programmable-credential-access`](../programmable-credential-access/) example.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/key-management/api-key-storage/
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

The script creates the trading service user, imports a demo credential, creates the retrieval policy, lists the org's secrets, exports the credential as the service user, and verifies the round trip.
