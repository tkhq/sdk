# Example: `with-proxy-signed-requests`

This example demonstrates the [proxying signed requests](https://docs.turnkey.com/authentication/proxying-signed-requests) pattern using `@turnkey/react-wallet-kit`.

**The flow:**

1. The user authenticates via email OTP and gets an embedded wallet
2. On the dashboard, the user enters a payload and clicks "Stamp & Proxy to Server"
3. The client stamps the `signRawPayload` request using its session key
4. The stamped `{ url, body, X-Stamp }` is sent to a Next.js server action
5. The server forwards it to Turnkey and returns the result

This pattern is useful when your backend needs to intercept requests before they reach Turnkey — for logging, transaction broadcasting, business logic, or rate limiting — without ever holding the user's signing key.

## Getting started

### 1/ Clone the repo

```bash
git clone https://github.com/tkhq/sdk
cd sdk/
corepack enable
pnpm install -r
pnpm run build-all
cd examples/with-proxy-signed-requests/
```

### 2/ Set up Turnkey

Follow the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) to get:

- A parent organization ID
- A parent org API key pair (public + private)

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
API_PUBLIC_KEY=          # parent org API public key  (server-side only)
API_PRIVATE_KEY=         # parent org API private key (server-side only)
NEXT_PUBLIC_ORGANIZATION_ID=  # parent org ID
NEXT_PUBLIC_BASE_URL=https://api.turnkey.com
```

### 3/ Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with your email, then use the dashboard to stamp and proxy a `signRawPayload` request.

## Stamping other requests

This example uses `stampSignRawPayload`, but every Turnkey API method has a corresponding `stamp*` variant that returns a `TSignedRequest` (`{ url, body, stamp }`) without sending the request. You can proxy any operation the same way — see [`sdk-client-base.ts`](https://github.com/tkhq/sdk/blob/main/packages/core/src/__generated__/sdk-client-base.ts) for the full list of `stamp*` methods.
