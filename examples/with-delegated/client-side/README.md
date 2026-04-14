# Example: `Setup Delegated Access`

This is a minimal **Next.js** app showing how to add a **Delegated Access (DA) API user** to an [embedded wallet](https://docs.turnkey.com/sdks/react/getting-started).

### What this demo shows

A high-level summary of the user experience and what you can see on screen.

1. Log in with [@turnkey/react-wallet-kit](https://www.npmjs.com/package/@turnkey/react-wallet-kit) and [Auth Proxy](https://docs.turnkey.com/sdks/react/getting-started#:~:text=1-,Enable%20Auth%20Proxy,-Navigate%20to%20the).

2. After login, the dashboard is split into two panels:

Setup Panel (left):

- Create a **Delegated Access (DA) user** with a P-256 API key
- Build and submit a Turnkey **policy** that restricts the DA user signing to a specific Ethereum recipient address
- **Validate** the policy by attempting two signatures: one expected to allow and one to deny.

Live Sub-Org State (right):

- View the **sub-organization ID**
- View the **users**, **rootQuorum**, **policies**, **wallet accounts** as updated by the changes done in the left panel.

---

## How it works

A step-by-step look under the hood:

1. **_User authentication_** via Auth Proxy::
   - Creates a new **sub-organization** with the user’s chosen auth method (email, OAuth, passkey, etc.) and an **embedded wallet** with an Ethereum account.
   - The authentication methods called by `handleLogin` are **idempotent** - existing users just log in.

> **Note:** You can use your own backend instead, but for simplicity we stick with the Auth Proxy. If you'd like to see how, check out this guide: [Advanced Backend Authentication](https://docs.turnkey.com/sdks/react/advanced-backend-authentication).

3. **Dashboard rendering**:
   - Right panel shows the live organization object from Turnkey (`getOrganization`), including users, root quorum, policies, and wallets.

4. **Delegated Access user creation:**
   - Done with [`fetchOrCreateP256ApiKeyUser`](https://docs.turnkey.com/generated-docs/formatted/react-wallet-kit/client-context-type-fetch-or-create-p256-api-key-user).

> **Note:** The DA user is non-root, so at this point any signing requests will be denied by the Turnkey policy engine until a policy is added.

5. **Policy management:**
   - Added via [`fetchOrCreatePolicies`](https://docs.turnkey.com/generated-docs/formatted/react-wallet-kit/client-context-type-fetch-or-create-policies)).
   - Example policy: “DA user can only sign Ethereum transactions to NEXT_PUBLIC_RECIPIENT_ADDRESS.”

6. **Policy Validation (Demo)**
   - Generates two unsigned Ethereum txs (allow + deny).
   - Submits them for signing, showing how the policy engine enforces your rules.

---

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-delegated/
```

### 2/ Setting up Turnkey

- Set up your Turnkey [organization and account](https://docs.turnkey.com/getting-started/quickstart#create-an-account) and write down the parent organization id.
- Enable [Auth Proxy](https://app.turnkey.com/dashboard/walletKit) from your Turnkey dashboard, choose the user auth methods and write down the Auth Proxy Config ID.
- Generate a P-256 API keypair for the Delegated Access user, you can do easily this via [CLI](https://docs.turnkey.com/sdks/cli#generate-an-api-key%E2%80%8B) or the `generateP256KeyPair()` helper function from the [@turnkey/crypto](https://github.com/tkhq/sdk/tree/main/packages/crypto) package. Save both the public and private API key.

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `NEXT_PUBLIC_ORGANIZATION_ID`
- `NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID`
- `NEXT_PUBLIC_RECIPIENT_ADDRESS`
- `NEXT_PUBLIC_DA_PUBLIC_KEY`
- `TURNKEY_DA_PUBLIC_KEY`
- `TURNKEY_DA_PRIVATE_KEY`

**Note:** NEXT_PUBLIC_DA_PUBLIC_KEY and TURNKEY_DA_PUBLIC_KEY hold the same public key. We keep them in two separate environment variables because:

- `NEXT_PUBLIC_DA_PUBLIC_KEY` is exposed to the browser (frontend).
- `TURNKEY_DA_PUBLIC_KEY` is used in server actions, where secrets belong.

### 2/ Running the demo

```bash
pnpm start
```
