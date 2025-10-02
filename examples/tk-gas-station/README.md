# Turnkey Gas Station SDK

A reusable SDK for implementing gasless transactions using EIP-7702, Turnkey wallet management, and your own paymaster. This package provides clean abstractions and utility methods to quickly integrate with Turnkey's contracts for sponsored transaction execution.

## What is This?

This SDK enables you to:

- **Bring your own paymaster** to sponsor user transactions
- **Use Turnkey** for secure wallet management and transaction signing
- **Execute gasless transactions** via EIP-7702 delegation and EIP-712 signed intents
- **Support any on-chain action** through generic execution parameters

Perfect for building dApps where users don't need ETH for gas, enabling seamless onboarding and better UX.

## How It Works

1. **EIP-7702 Authorization**: One-time setup where an EOA authorizes a gas station contract
2. **EIP-712 Signed Intents**: User signs off-chain intents for what they want to execute
3. **Paymaster Execution**: Your paymaster submits the transaction and pays for gas
4. **Turnkey Integration**: All signatures handled securely through Turnkey

## Quick Start

### 1. Install Dependencies

```bash
npm install @turnkey/sdk-server @turnkey/viem viem
```

### 2. Set Up Environment

Create `.env.local`:

```bash
# Turnkey Configuration
BASE_URL=https://api.turnkey.com
API_PRIVATE_KEY=your_turnkey_api_private_key
API_PUBLIC_KEY=your_turnkey_api_public_key
ORGANIZATION_ID=your_turnkey_organization_id

# Wallet Addresses
EOA_ADDRESS=0x...                    # User's wallet address
PAYMASTER=0x...                      # Your paymaster address

# RPC Configuration
BASE_RPC_URL=https://mainnet.base.org
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
```

**Note**: The gas station contracts are deployed at deterministic addresses across all chains and are built into the SDK. You don't need to specify them unless using custom deployments.

### 3. Initialize and Use

```typescript
import { GasStationClient, GasStationHelpers } from "./lib";
import { Turnkey } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import { parseEther, createWalletClient, http } from "viem";
import { base } from "viem/chains";

// Initialize Turnkey
const turnkeyClient = new Turnkey({
  apiBaseUrl: process.env.BASE_URL!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.ORGANIZATION_ID!,
});

// Create Turnkey accounts
const userAccount = await createAccount({
  client: turnkeyClient.apiClient(),
  organizationId: process.env.ORGANIZATION_ID!,
  signWith: process.env.EOA_ADDRESS as `0x${string}`,
});

const paymasterAccount = await createAccount({
  client: turnkeyClient.apiClient(),
  organizationId: process.env.ORGANIZATION_ID!,
  signWith: process.env.PAYMASTER as `0x${string}`,
});

// Create viem wallet clients
const userWalletClient = createWalletClient({
  account: userAccount,
  chain: base,
  transport: http(process.env.BASE_RPC_URL!),
});

const paymasterWalletClient = createWalletClient({
  account: paymasterAccount,
  chain: base,
  transport: http(process.env.BASE_RPC_URL!),
});

// Create Gas Station clients
const userClient = new GasStationClient({
  walletClient: userWalletClient,
  explorerUrl: "https://basescan.org",
});

const paymasterClient = new GasStationClient({
  walletClient: paymasterWalletClient,
  explorerUrl: "https://basescan.org",
});

// One-time: Authorize the EOA to use gas station
await userClient.authorize(paymasterClient);

// Execute a gasless ETH transfer
let nonce = await userClient.getNonce();
const ethIntent = await userClient
  .createIntent()
  .transferETH("0xRecipient...", parseEther("0.1"))
  .sign(nonce);
await paymasterClient.execute(ethIntent);

// Execute a gasless token transfer
nonce = await userClient.getNonce();
const usdcIntent = await userClient
  .createIntent()
  .transferToken(
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    "0xRecipient...",
    parseUnits("10", 6)
  )
  .sign(nonce);
await paymasterClient.execute(usdcIntent);
```

## Core API

### GasStationClient

Main client for gas station operations. Each client instance wraps a viem wallet client.

#### Constructor

```typescript
new GasStationClient({
  walletClient: WalletClient,          // Viem wallet client (e.g., with Turnkey account)
  explorerUrl: string,                 // Block explorer URL for transaction links
  delegateContract?: `0x${string}`,    // Optional: defaults to deterministic address
  executionContract?: `0x${string}`,   // Optional: defaults to deterministic address
})
```

#### Methods

**End User Methods** (call with user client):

**`signAuthorization(): Promise<SignedAuthorization>`**

- Sign an EIP-7702 authorization for the gas station contract
- Returns authorization that can be submitted by paymaster

**`createIntent(): Promise<IntentBuilder>`**

- Create a builder for composing transactions
- Intent must be signed before execution

**`getNonce(address?: Address): Promise<bigint>`**

- Get current nonce from gas station contract
- Defaults to the signer's address if not specified

**Paymaster Methods** (call with paymaster client):

**`submitAuthorization(auth: SignedAuthorization): Promise<{ txHash, blockNumber }>`**

- Submit a signed EIP-7702 authorization transaction
- Paymaster pays for gas

**`execute(intent: ExecutionIntent): Promise<{ txHash, blockNumber, gasUsed }>`**

- Execute a signed intent through the gas station
- Paymaster pays for gas

**Convenience Methods** (require both clients):

**`authorize(paymasterClient: GasStationClient): Promise<{ txHash, blockNumber }>`**

- Combined flow: user signs authorization, paymaster submits
- One-time setup per EOA

### GasStationHelpers

Utility methods for building common execution parameters.

**`buildETHTransfer(to: Address, amount: bigint): ExecutionParams`**

- Build params for native ETH transfer

**`buildTokenTransfer(token: Address, to: Address, amount: bigint): ExecutionParams`**

- Build params for ERC20 token transfer

**`buildTokenApproval(token: Address, spender: Address, amount: bigint): ExecutionParams`**

- Build params for ERC20 token approval

**`buildContractCall(params): ExecutionParams`**

- Build params for any contract function call
- Accepts `{ contract, abi, functionName, args, value? }`

### IntentBuilder

Composable builder for complex multi-step transactions.

```typescript
const nonce = await userClient.getNonce();
const builder = userClient.createIntent();

const intent = await builder
  .transferToken(usdcAddress, recipient, amount)
  .sign(nonce);

await paymasterClient.execute(intent);
```

## Common Use Cases

### Simple Payment

```typescript
// Gasless USDC payment
const nonce = await userClient.getNonce();
const intent = await userClient
  .createIntent()
  .transferToken(usdcAddress, recipientAddress, parseUnits("50", 6))
  .sign(nonce);

const result = await paymasterClient.execute(intent);
console.log(`Payment sent: ${result.txHash}`);
```

### Token Approval + DEX Swap

```typescript
// Step 1: Approve DEX to spend tokens
let nonce = await userClient.getNonce();
const approvalIntent = await userClient
  .createIntent()
  .approveToken(usdcAddress, dexAddress, parseUnits("100", 6))
  .sign(nonce);
await paymasterClient.execute(approvalIntent);

// Step 2: Execute swap
nonce = await userClient.getNonce();
const swapIntent = await userClient
  .createIntent()
  .callContract({
    contract: dexAddress,
    abi: DEX_ABI,
    functionName: "swapExactTokensForTokens",
    args: [amountIn, amountOutMin, path, recipient, deadline],
  })
  .sign(nonce);
await paymasterClient.execute(swapIntent);
```

### NFT Minting

```typescript
const nonce = await userClient.getNonce();
const mintIntent = await userClient
  .createIntent()
  .callContract({
    contract: nftContract,
    abi: NFT_ABI,
    functionName: "mint",
    args: [tokenId],
    value: parseEther("0.1"), // Optional ETH to send
  })
  .sign(nonce);

await paymasterClient.execute(mintIntent);
```

### User Onboarding

```typescript
async function onboardUser(userAddress: string) {
  // Create viem wallet client for user
  const userAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: ORGANIZATION_ID,
    signWith: userAddress as `0x${string}`,
  });

  const userWalletClient = createWalletClient({
    account: userAccount,
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  // Create Gas Station clients
  const userClient = new GasStationClient({
    walletClient: userWalletClient,
    explorerUrl: "https://basescan.org",
  });

  // Authorize user (paymaster pays)
  await userClient.authorize(paymasterClient);

  // User can now execute transactions without ETH
  console.log("✅ User ready for gasless transactions!");
}
```

## Running Examples

```bash
# ETH transfer on Base
npm run eth-transfer -- --chain base

# USDC transfer on Base
npm run usdc-transfer -- --chain base
```

## Architecture

### Gas Station Pattern

1. **Delegate Contract**: Authorized to EOA via EIP-7702
2. **Execution Contract**: Contains execution logic and nonce management
3. **EOA**: Signs EIP-712 intents off-chain
4. **Paymaster**: Submits transactions and pays gas

### Transaction Flow

```
User (EOA)
  ↓ Signs EIP-712 intent off-chain
  ↓
SDK (GasStationClient)
  ↓ Builds transaction
  ↓
Paymaster
  ↓ Submits transaction, pays gas
  ↓
Gas Station Contract
  ↓ Validates signature & nonce
  ↓ Executes on behalf of EOA
  ↓
Target Contract (USDC, NFT, DEX, etc.)
```

## Chain Support

Available presets for quick setup:

- **BASE_MAINNET** - Base mainnet (includes USDC address)
- **ETHEREUM_MAINNET** - Ethereum mainnet (includes USDC address)
- **SEPOLIA** - Sepolia testnet

```typescript
// Chain presets are available for quick configuration
import { CHAIN_PRESETS } from "./lib";

const basePreset = CHAIN_PRESETS.BASE_MAINNET;
const userWalletClient = createWalletClient({
  account: userAccount,
  chain: basePreset.chain,
  transport: http(basePreset.rpcUrl),
});

const userClient = new GasStationClient({
  walletClient: userWalletClient,
  explorerUrl: basePreset.explorerUrl,
});
```

## Security

- **EIP-712 Signed Intents**: All executions require valid typed signatures
- **Nonce Management**: Prevents replay attacks via on-chain nonce tracking
- **EIP-7702 Scoping**: Authorization is per-EOA and can be revoked
- **Turnkey Integration**: Private keys never leave Turnkey's secure infrastructure

## Troubleshooting

### Authorization Failed

- Ensure paymaster has ETH for gas
- Verify delegate contract address is correct
- Check EOA hasn't already been authorized

### Execution Failed

- Confirm EOA is authorized (`gasStation.authorize()`)
- Verify execution contract address matches deployment
- Check nonce hasn't been reused
- Ensure target contract call is valid

### Insufficient Funds

- EOA must have sufficient token balance for transfers
- Paymaster must have ETH for gas

### Invalid Signature

- Verify EOA address is correct
- Ensure chain ID matches the network
- Check intent was signed with correct nonce

## Advanced: Custom Contract Integration

For contracts beyond standard transfers:

```typescript
// Define your contract ABI
const MY_CONTRACT_ABI = [
  {
    name: "customFunction",
    type: "function",
    inputs: [
      { name: "param1", type: "uint256" },
      { name: "param2", type: "address" },
    ],
    outputs: [],
  },
];

// Build and execute
const nonce = await userClient.getNonce();
const intent = await userClient
  .createIntent()
  .callContract({
    contract: myContractAddress,
    abi: MY_CONTRACT_ABI,
    functionName: "customFunction",
    args: [12345, recipientAddress],
  })
  .sign(nonce);

// Execute gaslessly
await paymasterClient.execute(intent);
```

## Contract Deployment

You need to deploy two contracts:

1. **Delegate Contract** - Slim contract authorized via EIP-7702
2. **Execution Contract** - Contains `execute()` function and nonce storage

The execution contract should implement:

- `execute(address eoaAddress, uint128 nonce, address outputContract, uint256 ethAmount, bytes callData, bytes signature)`
- `getNonce(address eoaAddress) returns (uint128)`

See `abi/gas-station.ts` for the expected interface.

## Best Practices

1. **Client Separation**: Create separate client instances for users and paymasters
2. **Authorization**: Only call `authorize()` once per EOA
3. **Nonce Management**: Always fetch fresh nonce before creating intents
4. **Error Handling**: Wrap executions in try/catch for robust error handling
5. **Rate Limiting**: Implement paymaster rate limits to prevent abuse
6. **Monitoring**: Track gas costs and failed transactions for optimization

## License

See the main SDK repository for license information.
