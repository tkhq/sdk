# Example: `programmable-credential-access`

This example demonstrates multi-agent consensus for credential access with Turnkey secrets, following the [Programmable credential access](https://docs.turnkey.com/solutions/key-management/programmable-credential-access) solution:

- Modeling two agent roles (a payment agent and a browser agent) as Turnkey users
- Importing a credit card as a secret with policy-visible static properties
- Creating a consensus policy that requires both agents to approve any export
- Both agents signing and submitting the byte-identical export proposal in parallel
- The payment agent — and only the payment agent — decrypting the released payload

For the single-service retrieval flow, see the [`api-key-storage`](../api-key-storage/) example.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/key-management/programmable-credential-access/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey (a root user: the script creates the agent users and the policy)
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

The script creates the two agent users with locally generated API keys, imports a demo card, creates the consensus policy, has both agents co-sign the export in parallel, and verifies that the payment agent can decrypt the released payload.

Note: each run creates two new users and a policy in your organization (names are timestamped so reruns don't collide); clean them up from the dashboard as needed.
