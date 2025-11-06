# Example: `otp-auth-with-backend`

This is a minimal Next.js app showing how to implement [email OTP authentication](https://docs.turnkey.com/authentication/email) with Turnkey using the [@turnkey/react-wallet-kit](https://docs.turnkey.com/sdks/react), wired up to **your own backend** via Next.js Server Actions (see: [Advanced backend authentication](https://docs.turnkey.com/sdks/react/advanced-backend-authentication)).

> Using your own backend is **optional** — it’s an alternative to the Turnkey [Auth Proxy](https://docs.turnkey.com/reference/auth-proxy) for teams that prefer to manage authentication themselves.

### What this demo shows

A high-level summary of the user experience and what appears on screen:

- Authenticate with email OTP into a sub-organization.
- Automatically create or access a Turnkey sub-organization / embedded wallet tied to the user's email address.

Once logged in, access a dashboard with two panels:

**Left:** sign messages and simple demo transactions for both Ethereum (Sepolia testnet) and Solana (Devnet) using the **selected** embedded wallet account. Broadcasting uses a standard JSON-RPC client and returns the resulting transaction hash or signature.

> Broadcasting requires a rpcUrl, you can configure these URLs using `NEXT_PUBLIC_RPC_ETH` and `NEXT_PUBLIC_RPC_SOL`.
> Both Ethereum and Solana demo testnet transactions are send-to-self transfers with zero value, purely for demonstration purposes.

**Right:** view all the sub-organization embedded and connected wallets.

## How it works

1. **Send the OTP code**
   From your backend, call `initOtp` to send the OTP code to the user’s email.

2. **Verify the OTP**
   When the user submits the code, call `verifyOtp` in the backend with the otpId and otpCode to confirm that the user owns the email address.
   This step returns a `verificationToken`, which is required for logging in.

3. **Find or create a sub-organization**
   After a successful verification, look up the sub-organization associated with the user’s email:

- Call `getSuborgsAction({ filterValue: email })`.
- If no result then call `createSuborgAction({ email })`. The new sub-organization will automatically include a **Turnkey wallet** containing one **Ethereum** and one **Solana** account.

4. **Complete the login**
   Call `otpLogin` in the backend with the `verificationToken`, the `suborgID` from step 3, and the `publicKey` that was securely generated client-side using `createApiKeyPair` before initiating the OTP.
   Under the hood, `otpLogin` associates this publicKey with the user’s sub-organization in Turnkey, effectively registering it as the active session key.
   The call returns a new `session JWT` that references this keypair stored in the client’s indexedDb, which will be used to sign all subsequent authenticated requests.

> **Note:** The session JWT is a signed piece of metadata issued by Turnkey that references the client-side API keypair stored in indexedDb. It’s useful for server-side verification or associating user metadata, but cannot be used to authenticate or stamp API requests.
> Only the client-stored session keypair can create valid x-stamp signatures for Turnkey API calls — the JWT alone is not sufficient outside the client context.

5. **Store the session**
   Use `storeSession()` to persist the session in the browser. The SDK automatically handles authentication state and lifecycle management for you.

6. **Redirect to the dashboard**
   Once the session is stored, navigate the user to `/dashboard`, where they can view and use their embedded wallets.

> **Note:** The `initOtp`, `verifyOtp`, and `otpLogin` activities are handled through your backend server actions using the parent organization API keys. These endpoints should never be called directly from the client.

## Getting started

### 1/ Cloning the example

Make sure you have `node` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/otp-auth/with-backend
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID

Once you've gathered these values, add them to a new `.env.local` file. Notice that your API private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_ORGANIZATION_ID`
- `NEXT_PUBLIC_RPC_SOL`
- `NEXT_PUBLIC_RPC_ETH`

### 3/ Running the app

```bash
$ pnpm run dev
```

This command will run a NextJS app on port 3000. If you navigate to http://localhost:3000 in your browser, you can follow the prompts to start an oauth activity.
