# with-telegram

A Next.js example showing how to use **Telegram Login** (OIDC) to create and access a Turnkey embedded wallet.

## How it works

Telegram now exposes a standard OIDC provider at `https://oauth.telegram.org`. This example uses the authorization code + PKCE flow:

```
Browser → oauth.telegram.org/auth  (code_challenge, nonce = sha256(pubKey))
        ← /callback?code=...
Server  → oauth.telegram.org/token  (code + code_verifier + client_secret)
        ← id_token
Server  → Turnkey oauthLogin(id_token, pubKey)
        ← session
```

The token exchange happens in a Next.js server action — the `client_secret` (bot token secret) never leaves the server.

## Prerequisites

1. A Turnkey organization with a root API key
2. A Telegram bot — create one via [@BotFather](https://t.me/BotFather)
3. Enable "OAuth 2.0" / Login for your bot in @BotFather and register your redirect URI

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

| Variable                      | Description                                           |
| ----------------------------- | ----------------------------------------------------- |
| `API_PUBLIC_KEY`              | Turnkey root API key public key                       |
| `API_PRIVATE_KEY`             | Turnkey root API key private key                      |
| `NEXT_PUBLIC_ORGANIZATION_ID` | Your Turnkey organization ID                          |
| `NEXT_PUBLIC_BASE_URL`        | Turnkey API base URL                                  |
| `NEXT_PUBLIC_TELEGRAM_BOT_ID` | Telegram bot numeric ID (before `:` in the bot token) |
| `TELEGRAM_BOT_SECRET`         | Secret part of the bot token (after `:`)              |
| `NEXT_PUBLIC_REDIRECT_URI`    | Callback URL (e.g. `http://localhost:3000/callback`)  |

> The bot token from @BotFather looks like `123456789:ABCdefGHI...`. The numeric ID is `123456789` and the secret is `ABCdefGHI...`.

### 3. Configure your bot in @BotFather

Telegram requires a registered domain — `localhost` is not accepted. Use a tunnel for local development:

```bash
ngrok http 3000
```

Then in [@BotFather](https://t.me/BotFather):

1. `/mybots` → select your bot → **Bot Settings** → **Web Login**
2. **Switch to OAuth 2.0 Login** — confirm when prompted. This enables the new OIDC flow; the old Login Widget uses a different protocol and won't work with this example.
3. Under **Allowed URLs**, add both:
   - `https://abc123.ngrok-free.app` (your origin)
   - `https://abc123.ngrok-free.app/callback` (your redirect URI)
4. Update `NEXT_PUBLIC_REDIRECT_URI` in `.env.local` to `https://abc123.ngrok-free.app/callback`

### 4. Run

```bash
pnpm dev
```

Open the ngrok URL (not localhost) in your browser.

## Notes

- **Known issue:** Telegram's JWKS endpoint returns a mixed key set (RSA + EC/EdDSA). Turnkey's backend JWKS parser currently requires all keys to be RSA and fails on the non-RSA entries. A fix is in progress in mono — once deployed, this example will work end-to-end.
- Telegram requires `client_secret` in the token exchange (confirmed via CORS testing — the token endpoint does not allow browser requests). The `client_secret` stays in the Next.js server action and is never exposed to the browser.
- The `nonce` in the authorization request is bound to the Turnkey API key pair (`sha256(pubKey)`), same pattern as the Google OAuth example.
- Telegram does not expose a `userinfo_endpoint`, but Turnkey's token verification uses only the ID token JWT and the provider's JWKS — no UserInfo call needed.
