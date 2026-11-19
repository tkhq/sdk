# Example: `with-mppx`

This example shows how a key held in Turnkey signs identity proofs for
[mppx](https://github.com/wevm/mppx), the Machine Payments Protocol SDK. It
uses `createTurnkeyBotSigner` from `@turnkey/sdk-server`, which returns an mppx
identity `Signer`. The private key does not leave Turnkey.

The example runs two flows:

1. **Web Bot Auth.** An agent signs an HTTP request (RFC 9421) with
   `WebBotAuth.Client.prover`. The merchant verifies it with
   `WebBotAuth.Server.verifier`. A replay of the same request fails because
   the nonce is spent.
2. **MPP identity attestation.** An issuer signs an `mpp-attestation+jwt`
   about the agent with `Attestation.sign`. The merchant verifies it with the
   issuer's JSON Web Key Set, through `Attestation.Jwks.resolver`.

Mppx builds the signature base, the headers and the JWS. The adapter sends the
complete bytes to Turnkey with `HASH_FUNCTION_NOT_APPLICABLE`, then verifies
the returned signature against the public key before mppx uses it.

| File                | Contents                                                              |
| ------------------- | --------------------------------------------------------------------- |
| `src/flows.ts`      | The two mppx flows. Each takes a Turnkey key.                         |
| `src/offline.ts`    | A stand-in Turnkey client that signs with a local key, for tests.     |
| `src/index.ts`      | Runs the flows with Turnkey keys, or offline if no credentials exist. |
| `test/mppx.test.ts` | Checks both flows, the key IDs, replay and policy-denial errors.      |

## Requirements

- Node.js 24 or later. The example runs TypeScript directly.
- An mppx version that includes remote signers
  ([wevm/mppx#1286](https://github.com/wevm/mppx/pull/1286)). Version 0.18.1
  does not include it.

`mppx` is not yet in `package.json`. The version with remote signers is
published only as a `main` snapshot, and this repository installs only
packages that are at least 7 days old. Until an mppx release meets that rule,
build mppx from its `main` branch and link it into this example:

```bash
git clone https://github.com/wevm/mppx ../mppx   # any location
(cd ../mppx && pnpm install && pnpm build)
pnpm install
ln -s "$(cd ../mppx && pwd)" examples/identity/with-mppx/node_modules/mppx
```

When a release is available, add `mppx` to `dependencies` and rename
`test:mppx` and `typecheck:mppx` to `test` and `typecheck`, so that CI runs
them.

## Run the tests

```bash
pnpm run test:mppx
```

The tests do not need Turnkey credentials.

## Sign with Turnkey

1. Create a `CURVE_ED25519` private key in your organization. Give the API key
   that runs this example a policy that lets it sign with that key.
2. Copy `.env.local.example` to `.env.local` and set its values.
   `ISSUER_PRIVATE_KEY_ID` is optional. If you do not set it, the agent key
   also signs the attestation.
3. Run the demo:

```bash
pnpm start
```

Without `.env.local`, the demo runs offline with local keys.

If a Turnkey policy denies a signing request, the adapter throws
`TurnkeySigningError`. Its `code`, `activityId` and `activityStatus` fields
identify the activity for audit.
