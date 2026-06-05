# Example: `with-stellar`

This example shows how to build a browser-based Stellar wallet using [Turnkey](https://turnkey.com) and [`@turnkey/react-wallet-kit`](https://docs.turnkey.com/sdks/react). It demonstrates:

- Creating a Turnkey sub-organization with a Stellar HD wallet on first login
- Creating new Stellar wallet accounts
- Displaying wallet ID, account address(es), sub-org ID, and user ID
- Signing an arbitrary message with an ed25519 Stellar key
- Building, signing, and submitting a native XLM payment on Stellar testnet

The app is a single-page Next.js application. Authentication is handled by `@turnkey/react-wallet-kit` with no custom backend required. Turnkey's managed [Auth Proxy](https://docs.turnkey.com/reference/auth-proxy) handles sign-up and login securely from the browser.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-stellar/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and an Auth Proxy. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A Turnkey organization ID
- An Auth Proxy configuration (created in the Turnkey Dashboard under **Auth**)

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and fill in the environment variables:

| Variable                      | Required | Description                                                  |
| ----------------------------- | -------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_ORGANIZATION_ID` | Yes      | Your Turnkey organization ID                                 |
| `NEXT_PUBLIC_AUTH_PROXY_ID`   | Yes      | Your Auth Proxy configuration ID                             |
| `NEXT_PUBLIC_BASE_URL`        | No       | Turnkey API base URL (defaults to `https://api.turnkey.com`) |
| `NEXT_PUBLIC_AUTH_PROXY_URL`  | No       | Auth Proxy URL (defaults to `https://authproxy.turnkey.com`) |

### 3/ Running the app

```bash
$ pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

### 4/ Using the app

**Sign up / Log in**

On first visit, click **Login with Turnkey** to open the auth modal. Sign up with an email OTP or passkey. Turnkey provisions a new sub-organization containing:

- a Stellar HD wallet (one account at path `m/44'/148'/0'/0'/0`)

Returning users are prompted to log in with their existing credential.

**Wallet Info**

After login, the dashboard shows:

- User ID and sub-org ID
- All Stellar wallets with their wallet IDs and account addresses (linked to [Stellar Expert](https://stellar.expert/explorer/testnet))
- A **+ New Wallet** button to create additional Stellar wallets

**Sign Message**

Enter any text and click **Sign Message**. The react-wallet-kit confirmation modal opens; approve the request to produce an ed25519 signature over the raw UTF-8 bytes.

**Send Transaction**

Enter a destination Stellar address and an amount in XLM.

If your account has not been funded yet, click **Fund with Friendbot** to receive testnet XLM from the [Stellar Friendbot](https://friendbot.stellar.org).

Click **Send Transaction** to build a native XLM payment, sign the transaction hash with your Turnkey key, and submit it to Stellar testnet. A link to [Stellar Expert](https://stellar.expert/explorer/testnet) is shown on success.

## How it works

Stellar uses the **ed25519** curve, which Turnkey supports natively via `ADDRESS_FORMAT_XLM`. Transaction signing follows the pattern required by [RFC 8032](https://datatracker.ietf.org/doc/html/rfc8032):

1. Build a `TransactionBuilder` envelope using `@stellar/stellar-sdk`
2. Compute the 32-byte SHA-256 hash of the transaction's signature base (network passphrase + transaction XDR)
3. Call `httpClient.signRawPayload` from `useTurnkey()` with the hex-encoded hash, `encoding: PAYLOAD_ENCODING_HEXADECIMAL`, and `hashFunction: HASH_FUNCTION_NOT_APPLICABLE`
4. Concatenate the returned `r` and `s` components to form the 64-byte ed25519 signature
5. Attach the decorated signature to the transaction envelope and submit via Horizon
