# Gas Station Policy Tests

Comprehensive test suite for Gas Station SDK policy enforcement using Jest.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Configure environment variables in `.env.local`:
   ```bash
   BASE_URL=https://api.turnkey.com
   API_PRIVATE_KEY=your_turnkey_api_private_key
   API_PUBLIC_KEY=your_turnkey_api_public_key
   ORGANIZATION_ID=your_turnkey_organization_id
   ```

## Running Tests

```bash
# Run all tests
pnpm test

# Run policy tests specifically
pnpm test:policies

# Run tests in watch mode
pnpm test:watch
```

## Test Coverage

### Layer 1: EOA Intent Signing Policy

Tests that verify EOA users can only sign intents allowed by their policies:

- ✅ EOA signs USDC transfer (allowed)
- ❌ EOA signs DAI transfer (blocked initially)
- ✅ EOA signs DAI transfer after policy added

### Layer 2: Paymaster Execution Policy

Tests that verify paymasters can only execute transactions allowed by their policies:

- ✅ Paymaster executes USDC (allowed)
- ❌ Paymaster executes DAI (blocked)
- ❌ Paymaster with wrong execution contract address (blocked)

### Defense in Depth

Tests demonstrating two-layer protection:

- Both layers must allow a transaction for it to succeed
- USDC: EOA ✅ + Paymaster ✅ = Success
- DAI: EOA ✅ + Paymaster ❌ = Blocked

## Architecture

Each test run creates a fresh sub-organization with:

- Admin user (parent org credentials)
- EOA user (dynamically generated keys)
- Paymaster user (dynamically generated keys)
- Separate wallets for EOA and paymaster
- Policies enforcing USDC-only for both layers initially

Tests verify that policies correctly restrict signing at both the intent layer (EOA) and execution layer (paymaster).
