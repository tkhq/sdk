# Example: `export-in-node`

This example demonstrates the following:

- Programmatic export of a private key, wallet, or wallet account from your Turnkey organization
- Verification of enclave signature during export
- Decryption of sensitive data using HPKE (Hybrid Public Key Encryption)
- Waiting for approvals when the organization's root quorum is greater than 1

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/key-management/export-in-node/
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
Enter Export Type, either wallet, key, account:
```

### 4/ Organizations with a root quorum greater than 1

The export activity is subject to your organization's root quorum and consensus policies when these are enforced. Submitting the export counts as the first vote, so in an organization with a root quorum of 2 or more the activity comes back as `ACTIVITY_STATUS_CONSENSUS_NEEDED` instead of completing, and the response contains no export bundle.

The script detects this and waits:

```
⏳ Activity 01a0aab0-8736-75a9-b694-7ad4694978ac needs more approvals (root quorum > 1).
   fingerprint: sha256:f170f5dfc6ae216f62287c8494188926a90ffab766f88b181931f7056941f83f
   votes so far: 1

   Approve activity 01a0aab0-8736-75a9-b694-7ad4694978ac in the dashboard or use the approveActivity api endpoint to approve the fingerprint: sha256:f170f5dfc6ae216f62287c8494188926a90ffab766f88b181931f7056941f83f
   Keeping the target private key in memory; do not kill this process.
```

Approve the activity as another user who counts toward the quorum — from the Turnkey dashboard, or with the [`approveActivity`](https://docs.turnkey.com/api-reference/activities/approve-activity) endpoint, which takes the activity's **fingerprint**. Once the threshold is met, the script decrypts and prints the exported material as usual.

**Leave the process running while approvals are collected.** The export bundle is encrypted to a P-256 public key that the script generates at startup, and the matching private key only ever exists in this process's memory. If it exits before the last approval lands, that bundle can never be decrypted, and you will need to submit a new export and collect a new round of approvals.

The script polls every 5 seconds for up to 5 minutes (`POLL_INTERVAL_MS` and `POLL_ATTEMPTS` in [`src/index.ts`](./src/index.ts)), which is enough for an example where you approve the activity while you watch.
