# Example: `privy-migration`

Server-side example that migrates a **Privy embedded wallet** private key
into a **Turnkey**-managed private key. Runs entirely from a Node script;
the plaintext key never touches disk and is never logged.

Supports:

- Both **EVM (secp256k1)** and **Solana (ed25519)** via `--chain`.
- All three Privy **wallet-ownership** models via `--ownership`:
  - `app` — app / authorization-key-owned: **unattended bulk migration**, zero end-user interaction.
  - `user` — user-owned embedded wallet: **login-triggered per user** (needs the user's JWT).
  - `quorum` — 2-of-2 user + app: login-triggered, app co-signs.
- A `--mock` mode that lets you rehearse the Turnkey import path end-to-end without a Privy account.

## Why this works

Privy's export API and Turnkey's private-key import API both encrypt with
the **same HPKE cipher suite**, in HPKE BASE mode:

| Component | Value                     |
| --------- | ------------------------- |
| KEM       | DHKEM(P-256, HKDF-SHA256) |
| KDF       | HKDF-SHA256               |
| AEAD      | ChaCha20-Poly1305         |

Because the suites match, we can:

1. Ask Turnkey's enclave to issue a target encryption key (**TEK**) and
   sign it under the enclave quorum (`initImportPrivateKey`).
2. Call `privy.wallets().exportPrivateKey(walletId, { authorization_context })`
   from `@privy-io/node`. The SDK generates an ephemeral HPKE recipient
   key, asks Privy to encrypt the wallet key to it, decrypts inside the
   process, and returns the plaintext.
3. Re-encrypt the plaintext to the Turnkey TEK via `@turnkey/crypto`'s
   `encryptPrivateKeyToBundle` (which also verifies the enclave's
   signature on the TEK).
4. Submit the re-encrypted bundle to `importPrivateKey`. The enclave
   decrypts inside the TEE and stores the key as a first-class Turnkey
   resource.

## Flow

```
+---------+        HPKE ct         +--------------------+       HPKE ct        +----------------+
|  Privy  |----------------------->| migration script   |--------------------->| Turnkey enclave|
|  export |  encrypted to script's | (plaintext lives   |  encrypted to TEK    | decrypts + stores|
|         |  ephemeral P-256 pub   |  transiently here) |  (signature verified)| private key    |
+---------+                        +--------------------+                      +----------------+
      ^                                    |                                              ^
      |            Turnkey initImportPrivateKey                                           |
      |            returns TEK + quorum signature <------------------------------ (out of band, step 1)
```

## Does this work for embedded wallet users?

Yes — for **all** Privy ownership models. But the operational shape of the
migration depends on who owns the wallet, and that is a Privy
authorization property, not a Turnkey limitation. This example exposes
all three cases via `--ownership`.

| Case | `--ownership` | Wallet owner                                                                                                      | Who authorizes export                                                | Migration cadence             | End-user impact                                                                  |
| ---- | ------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| A    | `app`         | App / app-controlled authorization key (server-created wallets, or client-side wallets placed under an app owner) | App authorization key alone (`privy-authorization-signature` header) | **Unattended, bulk, silent**  | **None**                                                                         |
| B    | `user`        | User (classic user-owned client-side embedded wallet)                                                             | User's Privy JWT in `authorization_context.user_jwts`                | **Login-triggered, per user** | User has to log in at least once; no popup or approval prompt beyond normal auth |
| C    | `quorum`      | 2-of-2 user + app                                                                                                 | **Both** the user JWT **and** the app authorization key              | Login-triggered, app co-signs | Same as B                                                                        |

Key points:

- **App-owned wallets migrate silently in bulk.** No end-user interaction,
  no login required, no popups. Ideal for the majority of "user has
  never touched a key" apps.
- **User-owned wallets migrate at next login.** Privy deliberately makes
  the user the only party who can authorize export of a user-owned
  wallet. That is a structural property of the ownership model — no
  provider can bypass it, including Turnkey. The migration is still
  fully keyless on your infrastructure and requires no visible user
  action beyond a normal authenticated session.
- **Users who never return cannot be migrated** in cases B and C
  without their JWT. This is not a Turnkey gap; it is the direct
  consequence of the user having been the sole owner.

### Recommended rollout pattern

1. **Bucket wallets by ownership** using Privy's admin API.
2. **Bulk-migrate the app-owned bucket unattended** with
   `--ownership app`. Run it once, done.
3. **Silently migrate the user-owned bucket at next login.** On your
   authenticated session handler, if the current user still has a Privy
   wallet, run `--ownership user` (or `quorum`) with their JWT before
   handing them off to Turnkey for subsequent signing. No UI change.
4. **Set a sunset window** for the login-triggered path. Communicate a
   date after which unreturning users are considered stale and their
   Privy wallets are frozen / archived per your risk policy.

## Trust boundary (be honest about this)

Between the Privy decrypt and the Turnkey re-encrypt, the plaintext key
exists **in the Node process's heap** on the machine running this
script. This example takes the following pragmatic steps:

- The Privy recipient private key is generated by WebCrypto (via
  `@hpke/core`) and is never exported.
- The decrypted byte buffer is zeroed as soon as the plaintext has been
  re-encoded for `encryptPrivateKeyToBundle`.
- Nothing is written to disk. Nothing is logged. The example logs only
  the key's _shape_ (`keyFormat` and string length).
- The Turnkey import bundle is HPKE-encrypted client-side to a target
  key that is signed by the Turnkey enclave quorum; the signature is
  verified by `@turnkey/crypto` before encryption.

That said: **any code that ever holds a plaintext key can retain a
copy**. Two things Turnkey recommends and this example does not do for
you:

1. **Run this migration on the most trusted machine you have access to
   for the smallest possible window** (ideally an ephemeral CI/enclave
   runner you tear down immediately after).
2. **Rotate.** Even after a successful migration, the previous provider
   still knew the key at some point in the past. If the assets are
   valuable, the safer play is to import to Turnkey **and then sweep**
   the assets to a fresh Turnkey-generated address. Turnkey's own
   migration guidance says the same.

If you need a stronger boundary (no plaintext in the migration script's
memory at all), the same HPKE-suite match lets you build a pass-through
variant that hands Privy's ciphertext-and-encapsulated-key directly to a
Turnkey enclave endpoint that unwraps and re-wraps entirely inside the
TEE. That is a Turnkey backend change, out of scope for this SDK
example.

## Prerequisites

- Node 18+
- A Turnkey organization (or sub-organization) with an API key pair, and
  the `userId` that should own the imported private key.
- For the live path: a Privy app with `app-id` / `app-secret`, and the
  `wallet_id` of the embedded wallet you want to migrate.
- Depending on `--ownership`:
  - `app` — the app authorization private key (`PRIVY_AUTHORIZATION_PRIVATE_KEY`).
  - `user` — a valid Privy user session JWT (`PRIVY_USER_JWT`).
  - `quorum` — both of the above.

## Setup

From the repo root:

```bash
corepack enable
pnpm install -r
pnpm run build-all
cd examples/key-management/privy-migration
cp .env.local.example .env.local
# edit .env.local with your credentials
```

## Run: mock mode (no Privy account required)

Generates a throwaway private key locally to stand in for "the key
Privy would have returned", then runs the real Turnkey import path.
Prints which ownership path is being simulated and what auth material a
live run in that mode would require, so the mock is educational rather
than misleading.

```bash
pnpm start -- --chain evm     --ownership app     --mock
pnpm start -- --chain evm     --ownership user    --mock
pnpm start -- --chain solana  --ownership quorum  --mock
```

Use this to prove the Turnkey side of the flow works end-to-end in your
environment before wiring up Privy credentials.

## Run: live mode

```bash
# App-owned wallet, unattended bulk migration
pnpm start -- --chain evm --ownership app

# User-owned wallet, invoked from an authenticated user session
PRIVY_USER_JWT=<user-session-jwt> pnpm start -- --chain evm --ownership user

# 2-of-2 quorum
PRIVY_USER_JWT=<user-session-jwt> pnpm start -- --chain solana --ownership quorum
```

Uses `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, and `PRIVY_WALLET_ID` from
`.env.local`. Override the wallet id ad hoc with `--wallet wa_xxx`.

## Files

- `src/exportFromPrivy.ts` — Privy REST call + HPKE decrypt + ownership-
  aware auth (authorization_context.user_jwts and
  privy-authorization-signature). Isolated so it can be swapped for the
  Privy Node SDK or a bring-your-own-plaintext test harness. Includes a
  mock generator.
- `src/importToTurnkey.ts` — the three-step Turnkey import (init +
  encrypt-to-bundle + submit).
- `src/index.ts` — CLI wiring for `--chain`, `--ownership`, and `--mock`.

## Notes

- The Privy side uses the **official `@privy-io/node` SDK**
  (`privy.wallets().exportPrivateKey`). The SDK generates the ephemeral
  HPKE recipient key, calls the export endpoint with the correct
  `privy-authorization-signature` header built from the
  `AuthorizationContext`, and decrypts the response. Nothing about the
  signature canonicalisation, PKCS#8 key parsing, or HPKE handshake is
  hand-rolled in this example.
- The Turnkey side uses `@turnkey/crypto`'s `encryptPrivateKeyToBundle`,
  which encrypts to the enclave TEK with the matching HPKE suite and
  verifies the enclave quorum signature before encryption.
- Privy returns EVM keys as ASCII hex (`0x…`) and Solana keys as
  base58-encoded 64-byte keypairs; the example passes them straight
  through to `encryptPrivateKeyToBundle` with `keyFormat: "HEXADECIMAL"`
  or `"SOLANA"` respectively.
- This is a proof-of-concept for customer migration guidance. Before
  running against production wallets, review the trust-boundary section
  above and adapt the runtime environment accordingly.
