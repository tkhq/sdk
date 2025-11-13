# x402 with Turnkey Embedded Wallets

This example demonstrates how to use Coinbase's x402 payment protocol with Turnkey's embedded wallets for seamless payment authentication.

## Overview

This demo shows how to build a custom x402 middleware that integrates with Turnkey's embedded wallet system instead of relying on browser wallet extensions.

## How It Works

### 1. Middleware-Based Access Control

The demo uses Next.js middleware to gate access to protected content. The middleware (`middleware.ts`) intercepts requests to `/protected/*` routes and checks for a `payment-session` cookie:

- **If the cookie exists**: The user has made a valid payment and can access the protected content
- **If the cookie is missing**: The user is redirected to the paywall page to complete payment

This means the server is responsible for gating the access to the protected page. The cookie only lasts for 5 minutes and can be cleared before if needed.

### 2. Turnkey-Powered Payment Authorization

The payment page (`app/paywall/page.tsx`) uses Turnkey's embedded wallets to sign the payment authorization:

1. **Authentication**: Users log in to a Turnkey sub-org using the [`@turnkey/react-wallet-kit`](../../packages/react-native-wallet-kit/) package, which handles authentication with different methods
2. **Sign EIP-712 Payload**: The user signs an EIP-3009 `TransferWithAuthorization` message for USDC on Base Sepolia using the [`@turnkey/viem`](../../packages/viem/) package. This is a gasless transfer authorization that includes:
   - The sender (`from`) and recipient (`to`) addresses
   - The payment amount (0.01 USDC in this demo)
   - Validity period (5 minutes)
   - A unique nonce to prevent replay attacks
3. **Encode & Submit**: The signed authorization is encoded in x402 format using the [`x402`](https://www.npmjs.com/package/x402) package and submitted to the server for verification

### 3. Payment Verification with Public Facilitator

After the payload is signed, the [server route](./app/api/verify-payment/route.ts) uses a [public x402 facilitator](https://www.x402.org/facilitator) to verify the payment:

1. **Decode Payment**: The EIP-712 signed payment payload is decoded from the x402 format using the [`x402`](https://www.npmjs.com/package/x402) package
2. **Verify**: The facilitator's `/verify` endpoint validates that:
   - The signature is valid and signed by the claimed payer
   - The payment meets the requirements (amount, asset, recipient, timing)
   - The nonce hasn't been used before
3. **Settle**: If valid, the facilitator's `/settle` endpoint records the payment as settled
4. **Set Cookie**: Upon successful verification, a `payment-session` cookie is set with a 5-minute expiration

The facilitator acts as a neutral third party that verifies payments without requiring the merchant to run their own verification infrastructure. You can also host your own facilitator.

## Running The App

To start, ensure you have a [Turnkey organization setup](https://docs.turnkey.com/getting-started/quickstart) with [Auth Proxy enabled.](https://docs.turnkey.com/sdks/react/getting-started#turnkey-organization-setup)

### Configure your `.env.local` file

Copy the [`.env.local.example`](./.env.local.example) file and rename it to `.env.local` then fill in the following fields:

```
NEXT_PUBLIC_ORGANIZATION_ID="your-turnkey-organization-id"
NEXT_PUBLIC_AUTH_PROXY_ID="your-turnkey-auth-proxy-config-id"

NEXT_PUBLIC_FACILITATOR_URL=https://www.x402.org/facilitator    # This is a public, free, community maintained facilitator URL for x402; replace if you have your own
NEXT_PUBLIC_RESOURCE_WALLET_ADDRESS=0xYourResourceWalletAddressHere # This is the resource wallet address where payments will be sent. Replace with your own eth wallet address.
```

You can use any Ethereum wallet address to act as a resource wallet. The Base Sepolia USDC will go there.

### Start the Development Server

Install the packages and run the dev server:

```bash
pnpm i
pnpm run dev
```

You'll see the demo running on http://localhost:3000.
