# Payflow Demo - Automated Merchant Wallet & Fund Sweeping

This demo showcases how **Payflow** (a fintech startup) can use Turnkey to automate wallet creation and fund sweeping for their merchant payment rails.

## Overview

Payflow needs to:
1. Generate dedicated deposit wallets for each merchant on demand
2. Automatically sweep incoming USDC deposits into a single treasury (omnibus) wallet
3. Restrict fund movement by enforcing policies that only allow USDC transfers to the treasury wallet

## Architecture

This demo uses the following Turnkey primitives:

- **Sub-Organizations**: Each merchant gets their own isolated sub-organization for security and access control
- **Wallets**: Ethereum wallets are created for both merchants (deposit wallets) and the treasury (omnibus wallet)
- **Policies**: Restrictive policies are applied to ensure only USDC transfers to the treasury are allowed

### Key Components

1. **Merchant Creation** (`createMerchant.ts`): Creates a sub-organization and wallet for each merchant
2. **Policy Engine** (`createPolicy.ts`): Creates policies that restrict transactions to USDC-only transfers to treasury
3. **Fund Sweeping** (`sweepUSDC.ts`): Automatically transfers USDC from merchant wallets to treasury
4. **Treasury Management** (`treasury.ts`): Manages the central treasury wallet

## Getting Started

### Prerequisites

- Node.js v18+ installed
- A Turnkey organization with API credentials
- `pnpm` package manager (install via `corepack enable`)

### 1. Clone and Setup

```bash
# If you haven't already cloned the SDK
$ git clone https://github.com/tkhq/sdk
$ cd sdk/

# Install dependencies
$ corepack enable
$ pnpm install -r
$ pnpm run build-all

# Navigate to the demo
$ cd examples/payflow-demo/
```

### 2. Configure Environment Variables

Create a `.env.local` file in the `payflow-demo` directory:

```bash
# Turnkey API Credentials (required)
API_PUBLIC_KEY=your_api_public_key
API_PRIVATE_KEY=your_api_private_key
ORGANIZATION_ID=your_organization_id
BASE_URL=https://api.turnkey.com

# Treasury wallet (optional - will create new if not set)
TREASURY_WALLET_ADDRESS=

# Network configuration
NETWORK=sepolia  # or "goerli" for Goerli testnet

# USDC token address (optional - defaults based on network)
USDC_TOKEN_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

# Sweep threshold (optional - default: 0.03 USDC)
# Minimum USDC amount required in merchant wallets before a sweep is allowed
# This threshold is enforced at the Turnkey policy level
SWEEP_THRESHOLD_USDC=0.03

# Infura API key (REQUIRED - get your key at https://www.infura.io/)
INFURA_KEY=your_infura_api_key_here
```

**Getting Turnkey Credentials:**

1. Sign up at [https://app.turnkey.com](https://app.turnkey.com)
2. Create an organization
3. Generate API keys in the dashboard
4. Copy your `API_PUBLIC_KEY`, `API_PRIVATE_KEY`, and `ORGANIZATION_ID`

### 3. Run the Demo

```bash
$ pnpm demo
```

The demo will:
1. ✅ Create or retrieve a treasury wallet
2. ✅ Create a merchant sub-organization with a deposit wallet
3. ✅ Create a restrictive policy (USDC-only → treasury)
4. ✅ Attempt to sweep any USDC balance from merchant to treasury

### Expected Output

```
🚀 Payflow Demo - Automated Merchant Wallet & Fund Sweeping

📡 Network: sepolia
🪙 USDC Token: 0x1c7D...

============================================================
STEP 1: Setting up Treasury Wallet
============================================================
📦 Created new treasury wallet: 0x1234...5678
✅ Treasury Address: 0x1234...5678

============================================================
STEP 2: Creating Merchant Sub-Organization & Wallet
============================================================
✅ Sub-Organization ID: abc123...
✅ Wallet ID: def456...
✅ Merchant Address: 0xabcd...ef01

============================================================
STEP 3: Creating Restricted Policy
============================================================
✅ Policy Created: USDC-Only Policy for 0xabcd...ef01
   Policy ID: policy_xyz789...
   Restriction: USDC transfers only → 0x1234...5678

============================================================
STEP 4: Sweeping USDC to Treasury
============================================================
📊 Merchant wallet 0xabcd...ef01 has 0 USDC
⚠️  Sweep skipped: No USDC balance to sweep
   Note: To test the sweep, send some USDC to 0xabcd...ef01
   You can get testnet USDC from: https://faucet.circle.com/

============================================================
📋 DEMO SUMMARY
============================================================
Treasury Wallet:     0x1234...5678
Merchant Sub-Org:     abc123...
Merchant Wallet:      0xabcd...ef01
Merchant Wallet ID:   def456...
Policy ID:            policy_xyz789...
Policy Restriction:   USDC-only → 0x1234...5678
Sweep Status:         ⏸️  No USDC balance to sweep
============================================================

✨ Demo completed successfully!
```

## Testing the Sweep Functionality

To test the full flow including fund sweeping:

1. **Get Testnet USDC**: Visit [Circle's USDC Faucet](https://faucet.circle.com/) and request testnet USDC
2. **Send USDC to Merchant Wallet**: Transfer some USDC to the merchant address shown in the demo output
3. **Re-run the Demo**: The sweep will automatically transfer the USDC to the treasury

Alternatively, you can modify the demo to simulate a balance or use a wallet that already has USDC.

## Key Assumptions & Simplifications

1. **Policy Implementation**: The current policy implementation is simplified. In production, you would need to:
   - Parse transaction calldata to verify the transfer destination matches the treasury
   - Implement more granular policy conditions
   - Handle edge cases and additional security checks

2. **Treasury Wallet Lookup**: The demo creates a new treasury wallet if `TREASURY_WALLET_ADDRESS` is not set. In production, you'd want to:
   - Store wallet IDs in a database
   - Implement proper wallet lookup by address
   - Handle existing treasury wallets more robustly

3. **Sub-Organization Users**: The demo creates sub-orgs with minimal user setup. In production, you'd configure:
   - Proper authentication methods (API keys, passkeys, etc.)
   - User permissions and access controls
   - Multi-user quorum requirements

4. **Network Support**: Currently supports Sepolia and Goerli testnets. Mainnet support is available but requires appropriate configuration.

## References

This demo leverages patterns from:

- **[Sweeper Example](../sweeper)**: Fund transfer automation template
- **[Kitchen-Sink Example](../kitchen-sink)**: Multi-feature wallet operations including sub-org and policy creation
- **[Turnkey Documentation](https://docs.turnkey.com)**: 
  - [Sub-Organizations](https://docs.turnkey.com/concepts/sub-organizations)
  - [Policy Engine](https://docs.turnkey.com/concepts/policies/overview)
  - [Ethereum Policies](https://docs.turnkey.com/concepts/policies/examples/ethereum)

## Project Structure

```
payflow-demo/
├── src/
│   ├── index.ts           # Main demo orchestration
│   ├── createMerchant.ts  # Merchant sub-org & wallet creation
│   ├── createPolicy.ts    # Policy creation for USDC restrictions
│   ├── sweepUSDC.ts      # USDC transfer to treasury
│   ├── treasury.ts        # Treasury wallet management
│   ├── provider.ts        # Ethereum provider & Turnkey client setup
│   └── utils.ts           # Utility functions
├── package.json
├── tsconfig.json
└── README.md
```

## Next Steps

For production deployment, consider:

1. **Enhanced Policy Engine**: Implement more sophisticated policy conditions that parse transaction data
2. **Automated Monitoring**: Set up webhooks or polling to detect incoming USDC deposits
3. **Batch Processing**: Implement batch sweeping for multiple merchant wallets
4. **Error Handling**: Add retry logic and comprehensive error handling
5. **Logging & Analytics**: Implement proper logging and transaction tracking
6. **Security Hardening**: Review and enhance security measures for production use

## Support

For questions or issues:
- Turnkey Documentation: [https://docs.turnkey.com](https://docs.turnkey.com)
- Turnkey Support: [support@turnkey.com](mailto:support@turnkey.com)

