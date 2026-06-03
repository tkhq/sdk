# Example: `oauth-cross-platform` — Web

This is a Next.js app demonstrating **cross-platform OAuth identity registration** with Turnkey. A user signs up once with Google on the web and their wallet is immediately accessible from iOS and Android apps — no additional login or migration required.

## The problem this solves

OAuth providers like Google issue a different `client_id` (the `aud` claim in the OIDC token) per platform: one for web, one for iOS, one for Android. Without cross-platform registration, a user who signs up on web gets an OAuth identity tied to the web `aud`. When they try to log in from your mobile app, Turnkey sees a different `aud` and finds no matching identity.

## How it works

When the user signs up, the server action creates a sub-organization with three OAuth providers:

```
oauthProviders: [
  { providerName: "Google Web", oidcToken: "eyJ..." },   // verified — signed by Google
  { providerName: "Google", oidcClaims: { iss, sub, aud: IOS_CLIENT_ID } },   // unverified claim
  { providerName: "Google", oidcClaims: { iss, sub, aud: ANDROID_CLIENT_ID } }, // unverified claim
]
```

The `oidcToken` provider is verified by Google's public keys. The `oidcClaims` providers share the same `iss`/`sub` (same user, same provider) and are marked **verified-by-association** — because the token proves the user's Google identity, the secondary audiences for the same identity are also trusted.

On the dashboard you can confirm this by clicking **Verify access** for each platform, which calls `getSubOrgIds` with `filterType: "OAUTH_CLAIM"` and the platform's `aud`. All three resolve to the same sub-org ID.

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/tkhq/sdk
cd sdk/
corepack enable
pnpm install -r
pnpm run build-all
cd examples/oauth-cross-platform/web
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable                               | Description                                 |
| -------------------------------------- | ------------------------------------------- |
| `API_PUBLIC_KEY`                       | Turnkey API public key                      |
| `API_PRIVATE_KEY`                      | Turnkey API private key                     |
| `NEXT_PUBLIC_ORGANIZATION_ID`          | Your Turnkey parent org ID                  |
| `NEXT_PUBLIC_BASE_URL`                 | `https://api.turnkey.com`                   |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`         | Google OAuth web client ID                  |
| `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID`     | _(optional)_ Google OAuth iOS client ID     |
| `NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | _(optional)_ Google OAuth Android client ID |

The secondary client IDs are optional — the app works as a standard OAuth example without them, but you won't see the cross-platform verification panel.

> **Google Cloud setup:** In your Google Cloud project, open [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) and create OAuth 2.0 credentials for each platform (Web, iOS, Android). For the web credential, add `http://localhost:3000` to the list of authorized JavaScript origins. All three can live in the same Google Cloud project and share the same user pool — that's what makes cross-platform work.

### 3. Run

```bash
pnpm run dev
```

Visit [http://localhost:3000](http://localhost:3000), sign in with Google, then open the dashboard to see all registered platform identities and verify each one.

## Part 2 — Mobile login

See [`../mobile/README.md`](../mobile/README.md) for how to wire up a React Native app that logs in using the iOS or Android client ID registered here.
