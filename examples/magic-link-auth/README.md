# Example: `Magic Link Login / Signup`

This is a minimal **Next.js** app showing how to build a **“magic link” login and signup flow** using Turnkey’s email OTP system.

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
   - The app calls [`initOtp`](https://docs.turnkey.com/api-reference/activities/init-generic-otp) with the user’s email and an `emailCustomization` object containing a `magicLinkTemplate`:

     ```ts
     emailCustomization: {
       // %s will be replaced with the otpCode when sending the email
       magicLinkTemplate: "http://localhost:3000?otpCode=%s",
     },
     ```

   - The `%s` placeholder in the template will be replaced by Turnkey with both the **`otpId`** and **`otpCode`** when the email is sent, producing a fully functional magic link.

   - The response returns an `otpId` that will be required later when the user clicks the link. We store this `otpId` in `localStorage` for use after redirection.

2. **_Magic link redirect_**
   - The user clicks the magic link in their email and is redirected back to the app at a URL like:

     ```bash
     http://localhost:3000?otpCode=<code>
     ```

   - On page load, the frontend automatically extracts the `otpCode` from the query parameters and retrieves the stored `otpId` from `localStorage`.

   - It then proceeds to complete the authentication flow.

3. **_Verify OTP_**
   - The app calls [`verifyOtp`](https://docs.turnkey.com/api-reference/activities/verify-generic-otp) with the `otpId` and `otpCode`.
   - This returns a `verificationToken`, which contains their email address.

4. **_Getting the Sub-organization Id_**
   - The email is extracted from the decoded `verificationToken` payload.
   - The app checks if a sub-organization already exists for that email:
     - If **no sub-org** exists → it creates one.
     - If it **does exist** → it reuses it.

   - In both cases, the process results in a valid `suborgId`.

5. **_Login with OTP_**
   - The app calls [`otpLogin`](https://docs.turnkey.com/api-reference/activities/login-with-otp) with the `verificationToken`, `publicKey`, and `suborgId`.
   - This final step issues a **session token**, completing the magic link login/signup flow.

6. **_Session storage_**
   - The frontend stores the resulting session using the Turnkey SDK’s `storeSession` method.
   - From this point onward, the user is authenticated and can interact with their Turnkey-managed wallets and sub-organization.

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
$ cd examples/otp-auth/
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
