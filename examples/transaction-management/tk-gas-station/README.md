# Example: Gas Station with Turnkey

This example demonstrates how to implement gasless transactions using the Turnkey Gas Station SDK with EIP-7702 authorization. Users can execute on-chain transactions without holding ETH for gas - your paymaster covers the cost.

For complete API documentation, architecture details, and security best practices, see the **[@turnkey/gas-station package README](https://github.com/tkhq/sdk/tree/main/packages/gas-station)**.

## What This Example Shows

- **ETH Transfer**: Gasless ETH transfer from user wallet to recipient
- **USDC Transfer**: Gasless ERC-20 token transfer using EIP-7702 delegation
- **Turnkey Integration**: Secure key management for both user and paymaster wallets
- **Policy Enforcement**: Tests demonstrating Turnkey policy restrictions

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/tkhq/sdk
cd sdk/
corepack enable
pnpm install -r
pnpm run build-all
cd examples/tk-gas-station/
```

### 2. Configure Environment

Create `.env.local`:

```bash
# Turnkey Configuration
BASE_URL=https://api.turnkey.com
API_PRIVATE_KEY=your_turnkey_api_private_key
API_PUBLIC_KEY=your_turnkey_api_public_key
ORGANIZATION_ID=your_turnkey_organization_id

# Wallet Addresses
EOA_ADDRESS=0x...                            # User's wallet address
PAYMASTER_ADDRESS=0x...                      # Your paymaster address

# RPC Configuration
BASE_RPC_URL=https://mainnet.base.org
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...

# Gas Station Contracts (Optional - defaults to deterministic addresses)
DELEGATE_CONTRACT=0x...    # EIP-7702 delegate contract
EXECUTION_CONTRACT=0x...   # Gas Sponsorship entrypoint contract which calls the delegate.
```

**Note**: The gas station contracts are deployed at deterministic addresses on Ethereum Mainnet and Base Mainnet. These are built into the SDK, so you only need to specify them for custom deployments.

### 3. Run Examples

```bash
# Gasless ETH transfer on Base
pnpm run eth-transfer -- --chain base

# Gasless USDC transfer on Base
pnpm run usdc-transfer -- --chain base

# Run policy enforcement tests
pnpm run test:policies
```

### Example Output

Here's what a successful USDC transfer looks like:

```
> pnpm run usdc-transfer -- --chain base

🌐 Using BASE network
        USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

✓ EOA already authorized
        Skipping authorization

===== Starting USDC Transfer =====

Executing USDC transfer
        10000 units (0.01 USDC) to 0x30E9...

Current nonce: 29

Signing EIP-712 execution intent...

✓ Intent signed: 0xdccca0c7f553c5b7b0...

✓ Intent signed by user

Executing intent via gas station...

Execution transaction sent
        0xb3eb...

Waiting for confirmation...

✅ Execution SUCCEEDED

Confirmed
        Block: 36529242, Gas: 68572

===== USDC Transfer Complete =====

✅ Successfully transferred 0.01 USDC from EOA to paymaster
        TX: https://basescan.org/tx/0xb3ebc...

Gas usage
        68572 gas units
```

## Example Code Walkthrough

### ETH Transfer (`src/transferETHDelegated.ts`)

Demonstrates a complete flow for gasless ETH transfers:

1. **Initialize Turnkey clients** for user and paymaster
2. **One-time authorization** via EIP-7702 (if not already authorized)
3. **Create and sign intent** off-chain using EIP-712
4. **Execute transaction** with paymaster covering gas costs

Key code snippet:

```typescript
// User creates and signs intent off-chain
const nonce = await userClient.getNonce();
const intent = await userClient
  .createIntent()
  .transferETH(recipientAddress, parseEther("0.01"))
  .sign(nonce);

// Paymaster executes and pays for gas
const result = await paymasterClient.execute(intent);
console.log(`✅ Transaction: ${result.txHash}`);
console.log(`🔗 Explorer: https://basescan.org/tx/${result.txHash}`);
```

### USDC Transfer (`src/transferUSDCDelegated.ts`)

Similar flow but for ERC-20 token transfers:

```typescript
const nonce = await userClient.getNonce();
const intent = await userClient
  .createIntent()
  .transferToken(
    usdcAddress,
    recipientAddress,
    parseUnits("0.01", 6), // 0.01 USDC
  )
  .sign(nonce);

await paymasterClient.execute(intent);
```

### Policy Enforcement Tests (`src/__tests__/policyEnforcement.test.ts`)

Demonstrates how Turnkey policies restrict what transactions can be signed:

- **EOA policies**: Restrict which contracts and amounts the user can sign
- **Paymaster policies**: Restrict which transactions the paymaster can execute
- **Defense in depth**: Combine both policy layers for maximum security

## Architecture Overview

```
User (EOA)
  ↓ Signs EIP-712 intent off-chain (no gas needed)
  ↓
Paymaster
  ↓ Submits transaction, pays gas
  ↓
Gas Station Contract (EIP-7702)
  ↓ Validates signature & nonce
  ↓ Executes on behalf of EOA
  ↓
Target Contract (Transfer ETH/USDC/etc)
```

## Key Features

- **No ETH Required**: Users don't need ETH to execute transactions
- **Secure**: All keys managed by Turnkey, signatures validated on-chain
- **Flexible**: Works with any contract call, not just transfers

## Chain Support

This example works on:

- **Base Mainnet** (default in examples)
- **Ethereum Mainnet**

## Learn More

- **Full Documentation**: See the [@turnkey/gas-station README](https://github.com/tkhq/sdk/tree/main/packages/gas-station)
- **API Reference**: Complete method documentation in the package README
- **Security Policies**: Learn how to write custom Turnkey policies
- **Advanced Use Cases**: Token swaps, NFT minting, and more

## Support

For questions and support:

- [Turnkey Documentation](https://docs.turnkey.com)
- [Turnkey Discord](https://discord.gg/turnkey)
- [GitHub Issues](https://github.com/tkhq/sdk/issues)
