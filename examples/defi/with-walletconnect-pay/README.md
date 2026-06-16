# Example: `with-walletconnect-pay`

This example shows how to integrate [`@walletconnect/pay`](https://www.npmjs.com/package/@walletconnect/pay) with [`@turnkey/react-native-wallet-kit`](https://www.npmjs.com/package/@turnkey/react-native-wallet-kit) for gasless USDC payments in a React Native app. Turnkey handles embedded wallet creation and EIP-712 signing; WalletConnect Pay handles transaction construction, gas sponsorship via 7702 paymaster, and on-chain broadcast.

## Demo

<div align="center">
  <video src="https://github.com/user-attachments/assets/01af3375-9bd8-4063-851b-0a90e84a0e70" controls width="400"></video>
</div>

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/examples/defi/with-walletconnect-pay/
$ npm install
```

### 2/ Setting up

To configure the demo wallet you'll need the following:

| Variable                                   | Description                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID`      | Your Turnkey organization ID from the [Turnkey Dashboard](https://app.turnkey.com)                                                   |
| `EXPO_PUBLIC_TURNKEY_API_BASE_URL`         | Turnkey API base URL (default: `https://api.turnkey.com`)                                                                            |
| `EXPO_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID` | Auth Proxy configuration ID for email OTP. Find it in the [Turnkey WalletKit Dashboard](https://app.turnkey.com/dashboard/walletKit) |
| `EXPO_PUBLIC_WC_API_KEY`                   | WalletConnect Pay API key from the [WalletConnect Dashboard](https://dashboard.walletconnect.com/)                                   |

Once you've gathered these values, add them to a new `.env.local` file. Notice that your credentials should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

#### WalletConnect Pay setup

1. Go to [dashboard.walletconnect.com](https://dashboard.walletconnect.com/) → create a new project → **select "Wallet" as the project type** (the WalletConnect Pay tab is not visible on App projects)
2. **WalletConnect Pay** tab → **API Keys** → generate a key → set it as `EXPO_PUBLIC_WC_API_KEY`
3. Under **TEST → Receiving addresses**, add your address in CAIP-10 format (e.g. `eip155:8453:0xYourAddress`)
4. Click **Go to POS App** → **New sale** → set an amount → a payment QR is generated

On the iOS simulator (no camera): click the QR code image in the WalletConnect dashboard to get the payment link, then paste it into the manual entry field in the app.

> **Note:** WalletConnect Pay is mainnet only. Testnets are not supported. The payer's wallet needs real USDC on Base (or another [supported chain](https://docs.walletconnect.com/payments/wallets/overview)). Since you set your own address as the merchant recipient, payments go back to yourself. ~$1 USDC is enough to test.

### 3/ Running the app

First, generate the native project:

```bash
$ npx expo prebuild --platform ios
```

**Option 1: CLI**

```bash
$ npx expo run:ios
```

**Option 2: Xcode**

```bash
# In one terminal: start the Metro bundler
$ npx expo start

# In another terminal (or double-click):
$ open ios/WCPayTurnkeyDemo.xcworkspace
```

Then in Xcode: select a simulator from the device picker (e.g., iPhone 17 Pro) and press **⌘R**.

### How it works

- [`app/_layout.tsx`](app/_layout.tsx): `TurnkeyProvider` wraps the app, providing auth state and `signMessage` to all screens
- [`constants/walletconnect.ts`](constants/walletconnect.ts): `WalletConnectPay` singleton client, initialized with your WC API key
- [`lib/turnkey-signer.ts`](lib/turnkey-signer.ts): bridges WC Pay RPC actions (`eth_signTypedData_v4`, `personal_sign`) to Turnkey's EIP-712 signing
- [`app/payment.tsx`](app/payment.tsx): orchestrates the full payment flow: fetch options → identity verification → sign → broadcast

### Flow

```
User ──▶ Email OTP ──▶ Turnkey creates sub-org + ETH wallet
  │
  ▼
Scan WC Pay QR ──▶ Fetch payment options from WC Pay
  │
  ▼
Confirm payment ──▶ Identity verification (if required)
  │
  ▼
Turnkey signs EIP-712 ──▶ WC Pay broadcasts via 7702 paymaster ──▶ ✅ On-chain
```

- **Auth:** Email OTP via Turnkey. Each user gets a dedicated sub-org with a 1-of-1 Ethereum wallet. Only the authenticated user can authorize signing.
- **Identity verification:** If required by the merchant (Travel Rule compliance), the user completes a WC Pay-hosted verification step before signing.
- **Gas:** Fully abstracted. Turnkey signs the EIP-712 payment authorization, WC Pay handles transaction construction and broadcast via its 7702 paymaster. No ETH required.

### Legal disclaimer

This demo is provided for testing and demonstration purposes only. It is not intended for production use. Use at your own risk.
