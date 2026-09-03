# MFA Examples

This app demonstrates three ways to use Turnkey multi-factor authentication
(MFA) with email OTPs, passkeys, and sessions.

## The three MFA scenarios

### Scenario 1: require MFA when signing

The user logs in normally. Signing a message requires both:

- An active session
- Passkey approval

Use this pattern when most actions can use a session, but sensitive actions
such as signing should prompt the user for another factor.

### Scenario 2: require MFA when logging in

Login requires both:

- An email OTP
- Passkey approval

After login, the resulting session can authorize later actions without another
passkey prompt.

Use this pattern when you want strong authentication at the start of a session
without prompting the user during normal activity.

### Scenario 3: require MFA when logging in and exporting a wallet

Login requires an email OTP and passkey. Normal activity requires only the
session, while wallet export requires the session plus another passkey
approval.

Use this pattern when login needs MFA and especially sensitive operations need
step-up authentication.

## Setup

You need:

- Node.js 18 or newer
- `pnpm`
- A [Turnkey organization](https://app.turnkey.com/)
- An Auth Proxy configuration with email OTP enabled
- A browser that supports passkeys

From this example's directory, create your local environment file:

```bash
cp .env.local.example .env.local
```

Add your Turnkey organization ID and Auth Proxy configuration ID to
`.env.local`:

```bash
NEXT_PUBLIC_ORGANIZATION_ID="your-organization-id"
NEXT_PUBLIC_BASE_URL="https://api.turnkey.com"
NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID="your-auth-proxy-config-id"
NEXT_PUBLIC_AUTH_PROXY_BASE_URL="https://authproxy.turnkey.com"
NEXT_PUBLIC_EXPORT_IFRAME_URL="https://export.turnkey.com"
```

Install and build the workspace from the repository root:

```bash
corepack enable
pnpm install
pnpm build-all
```

Start the example:

```bash
cd examples/demos/with-mfa-and-scoped-sessions
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Try scenario 1

1. Select **Scenario 1**.
2. Select **Login / Sign Up** and complete the email OTP flow.
3. Select **Add Passkey** and register a passkey.
4. Select **Create MFA Policy**.
5. Select **Sign Message** and approve the passkey prompt.

## Try scenario 2

1. Select **Scenario 2**.
2. Select **Setup Login / Sign Up** to create the user.
3. Add a passkey and create the MFA policies.
4. Select **Logout Before Testing Auth**.
5. Enter the same email and select **Send Email OTP**.
6. Enter the code and select **Verify OTP + Passkey Login**.
7. Approve the passkey prompt.

## Try scenario 3

1. Select **Scenario 3**.
2. Select **Initial Setup Login / Sign Up** to create the user.
3. Add a passkey, create a wallet, and create the MFA policies.
4. Select **Logout Before Testing Auth**.
5. Log in again with the same email, OTP, and passkey.
6. Select **Export Wallet**, then **Confirm Export**.
7. Approve the additional passkey prompt.

## Testing notes

MFA policies are saved on the Turnkey user. For the cleanest test, use a
different email address for each scenario. Reusing the same user can cause
policies from one scenario to affect another.

Passkeys require `localhost` or HTTPS. If OTP login reports that no
sub-organization exists, first complete that scenario's setup login with the
same email address.
