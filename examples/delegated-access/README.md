# Example: `delegated-access`

A sample application that quickly configures a Delegated Access setup (see https://docs.turnkey.com/concepts/policies/delegated-access):
- Creates a Sub-Organization with a Delegated user account and an End User account
- Creates a new Policy for the Delegated account
- Removed the Delegated account from the Root Quorum

**Note:** The end user is created without any authenticators, it will need to be updated during the sign-up flow

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/delegated-access/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey parent organization
- A public/private API key pair for the Delegated account
- An organization ID

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `TURNKEY_API_PUBLIC_KEY`
- `TURNKEY_API_PRIVATE_KEY`
- `TURNKEY_BASE_URL`
- `TURNKEY_ORGANIZATION_ID`
- `DELEGATED_API_PUBLIC_KEY`
- `DELEGATED_API_PRIVATE_KEY`
- `RECIPIENT_ADDRESS`

### 2/ Running the script

```bash
pnpm start
```

**Note:** Recommended to test out that the Delegated account API keys are highly scoped to sending ETH transactions only to the specified RECIPIENT_ADDRESS and tx's to other addresses (and all other actions) are not possible. In order to cary such tests one could use [Turkney CLI](https://github.com/tkhq/tkcli) or [this](https://github.com/tkhq/tkcli) signTransaction example.