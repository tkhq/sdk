# Example: `Magic Link Login / Signup`

This is a minimal **Next.js** app showing how to build a **"magic link" login and signup flow** using Turnkey's email OTP system.

---

### What this demo shows

A high-level overview of the user experience and what happens on screen:

1. The user enters their **email address** in a simple login form.
2. The app sends a **magic link** to their inbox.
3. The user clicks the link and is automatically logged in.

---

## How it works

A step-by-step look under the hood:

1. **_Send the magic link_**
   - The backend calls [`initOtp`](https://docs.turnkey.com/api-reference/activities/init-generic-otp) with the user's email and a `magicLinkTemplate`:

     ```ts
     emailCustomization: {
       // %s is replaced with the OTP code when the email is sent
       magicLinkTemplate: "http://localhost:3000?otpCode=%s",
     },
     ```

   - The response returns an `otpId` and an `otpEncryptionTargetBundle` (an ephemeral enclave public key). Both are stored in `localStorage` to be retrieved after the redirect.

2. **_Magic link redirect_**
   - The user clicks the magic link and is redirected to a URL like:

     ```
     http://localhost:3000?otpCode=<code>
     ```

   - On page load, the frontend extracts the `otpCode` from the URL and retrieves `otpId` and `otpEncryptionTargetBundle` from `localStorage`.

3. **_Generate a session keypair_**
   - The frontend calls `createApiKeyPair()` to generate a P256 keypair. The private half is stored in IndexedDB and never leaves the device.

4. **_Encrypt the OTP code_**
   - The frontend calls `encryptOtpCodeToBundle(otpCode, otpEncryptionTargetBundle, publicKey)` from `@turnkey/crypto`. This encrypts the code — along with the session public key — for the enclave's ephemeral key so the **plaintext OTP is never sent to the backend**.

5. **_Verify OTP_**
   - The backend calls [`verifyOtp`](https://docs.turnkey.com/api-reference/activities/verify-generic-otp) with `otpId` and `encryptedOtpBundle`.
   - This returns a `verificationToken` containing the user's email address and the session public key (extracted by the enclave from the encrypted bundle).

6. **_Build a client signature_**
   - The frontend calls `getClientSignatureMessageForLogin({ verificationToken })`, which returns the canonical `publicKey` decoded from the token. It signs the message with `signWithApiKey({ message, publicKey })`.
   - This proves to Turnkey that the caller holds the private key corresponding to `publicKey`, binding the session to the device.

7. **_Get or create the sub-organization_**
   - The email is extracted from the `verificationToken` payload.
   - The backend checks if a sub-organization already exists for that email:
     - If **no sub-org** exists → it creates one.
     - If it **does exist** → it reuses it.

8. **_Login with OTP_**
   - The backend calls [`otpLogin`](https://docs.turnkey.com/api-reference/activities/login-with-otp) with the `verificationToken`, `publicKey`, `suborgId`, and `clientSignature`.
   - This issues a **session token**, completing the magic link login/signup flow.

9. **_Session storage_**
   - The frontend stores the session using `storeSession`. The user is now authenticated and can interact with their Turnkey-managed wallets and sub-organization.

---

## Getting started

### 1/ Cloning the example

Make sure you have `node` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/magic-link-auth/
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

- `NEXT_PUBLIC_ORGANIZATION_ID`
- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`

### 3/ Running the app

```bash
$ pnpm run dev
```

This command will run a NextJS app on port 3000. If you navigate to http://localhost:3000 in your browser, you can follow the prompts to start.

---

## Implementation note: `LoginPage` is loaded with `ssr: false`

`page.tsx` dynamically imports `LoginPage` with `{ ssr: false }` so that Next.js skips server-rendering it entirely. This is required because `LoginPage` reads `window.location.search` in a `useState` initializer to detect the magic-link redirect and immediately show a loading screen instead of the login form:

```ts
const [isProcessingMagicLink, setIsProcessingMagicLink] = useState(() =>
  new URLSearchParams(window.location.search).has("otpCode"),
);
```

`window` is not available during SSR, and reading it there would either throw or produce a hydration mismatch (server renders the form; client corrects to the loading screen, causing a visible flash). With `ssr: false` the component only ever runs in the browser, so `window` is always defined and the initial state is correct on the very first render.
