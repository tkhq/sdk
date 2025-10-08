# Turnkey Gas Station SDK

> **⚠️ BETA WARNING**: This SDK is currently in beta. The underlying smart contracts are **unaudited** and should not be used in production environments. Use at your own risk.

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
pnpm install @turnkey/sdk-server @turnkey/viem viem
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
EOA_ADDRESS=0x...                            # User's wallet address
PAYMASTER_ADDRESS=0x...                      # Your paymaster address

# RPC Configuration
BASE_RPC_URL=https://mainnet.base.org
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...

# Gas Station Contracts (Optional - defaults to deterministic addresses)
DELEGATE_CONTRACT=0x...    # EIP-7702 delegate contract
EXECUTION_CONTRACT=0x...   # Gas Sponsorship entrypoint contract which calls the delegate.
```

**Note**: The gas station contracts are currently deployed at deterministic addresses on the following chains:

- **Ethereum Mainnet**
- **Base Mainnet**

These addresses are built into the SDK, so you don't need to specify them unless you are using custom deployments.

### 3. Initialize and Use

```typescript
import { GasStationClient } from "@turnkey/gas-station";
import { Turnkey } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import { parseEther, parseUnits, createWalletClient, http } from "viem";
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
});

const paymasterClient = new GasStationClient({
  walletClient: paymasterWalletClient,
});

// One-time: Authorize the EOA to use gas station
const authorization = await userClient.signAuthorization();
await paymasterClient.submitAuthorizations([authorization]);

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
    parseUnits("10", 6),
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

**`submitAuthorizations(authorizations: SignedAuthorization[]): Promise<{ txHash, blockNumber }>`**

- Submit signed EIP-7702 authorization transaction(s)
- Supports authorizing multiple EOAs in a single transaction
- Paymaster pays for gas

**`execute(intent: ExecutionIntent): Promise<{ txHash, blockNumber, gasUsed }>`**

- Execute a signed intent through the gas station
- Paymaster pays for gas

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
  });

  // Authorize user (paymaster pays)
  const authorization = await userClient.signAuthorization();
  await paymasterClient.submitAuthorizations([authorization]);

  // User can now execute transactions without ETH
  console.log("✅ User ready for gasless transactions!");
}
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

```typescript
// Chain presets are available for quick configuration
import { CHAIN_PRESETS, GasStationClient } from "@turnkey/gas-station";
import { createWalletClient, http } from "viem";

const basePreset = CHAIN_PRESETS.BASE_MAINNET;
const userWalletClient = createWalletClient({
  account: userAccount,
  chain: basePreset.chain,
  transport: http(basePreset.rpcUrl),
});

const userClient = new GasStationClient({
  walletClient: userWalletClient,
});
```

## Security

- **EIP-712 Signed Intents**: All executions require valid typed signatures
- **EIP-7702 Scoping**: Authorization is per-EOA and can be revoked
- **Deadline Enforcement**: Each transaction includes a deadline (Unix timestamp) to prevent replay attacks; signatures expire after this time
- **Turnkey Integration**: Private keys never leave Turnkey's secure infrastructure

### Security Policies

Turnkey policies provide additional security layers by restricting what transactions can be signed and executed. The Gas Station SDK includes helpers for creating these policies.

#### EOA Intent Signing Policies

Restrict what EIP-712 intents the EOA can sign:

```typescript
import { buildIntentSigningPolicy } from "@turnkey/gas-station";

// USDC-only policy
const eoaPolicy = buildIntentSigningPolicy({
  organizationId: "your-org-id",
  eoaUserId: "user-id",
  restrictions: {
    allowedContracts: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"], // USDC on Base
    disallowEthTransfer: true, // Disallow ETH transfers
  },
  policyName: "USDC Only Policy",
});

// Resulting policy restricts signing to USDC transfers only:
// {
//   organizationId: "your-org-id",
//   policyName: "USDC Only Policy",
//   effect: "EFFECT_ALLOW",
//   consensus: "approvers.any(user, user.id == 'user-id')",
//   condition: "activity.resource == 'PRIVATE_KEY' && " +
//              "activity.action == 'SIGN' && " +
//              "eth.eip_712.primary_type == 'Execution' && " +
//              "(eth.eip_712.message['outputContract'] == '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913') && " +
//              "eth.eip_712.message['ethAmount'] == '0'",
//   notes: "Restricts which EIP-712 intents the EOA can sign for gas station execution"
// }
```

#### Paymaster Execution Policies

Restrict what on-chain transactions the paymaster can submit:

```typescript
import {
  buildPaymasterExecutionPolicy,
  DEFAULT_EXECUTION_CONTRACT,
  ensureGasStationInterface,
} from "@turnkey/gas-station";
import { parseGwei, parseEther } from "viem";

// First, ensure the Gas Station ABI is uploaded (enables ABI-based policies)
await ensureGasStationInterface(
  turnkeyClient.apiClient(),
  "your-org-id",
  DEFAULT_EXECUTION_CONTRACT,
  undefined,
  "Base Mainnet",
);

// Paymaster protection policy with ETH amount limit
const paymasterPolicy = buildPaymasterExecutionPolicy({
  organizationId: "paymaster-org-id",
  paymasterUserId: "paymaster-user-id",
  executionContractAddress: DEFAULT_EXECUTION_CONTRACT,
  restrictions: {
    allowedEOAs: ["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"],
    allowedContracts: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
    maxEthAmount: parseEther("0.1"), // Max 0.1 ETH per EOA transaction
    maxGasPrice: parseGwei("50"), // Max 50 gwei gas price
    maxGasLimit: 500000n, // Max 500k gas limit
  },
  policyName: "Paymaster Protection",
});

// Resulting policy uses ABI parsing for direct argument access:
// {
//   organizationId: "paymaster-org-id",
//   policyName: "Paymaster Protection",
//   effect: "EFFECT_ALLOW",
//   consensus: "approvers.any(user, user.id == 'paymaster-user-id')",
//   condition: "activity.resource == 'PRIVATE_KEY' && " +
//              "activity.action == 'SIGN' && " +
//              "eth.tx.to == '0xe511ad0a281c10b8408381e2ab8525abe587827b' && " +
//              "(eth.tx.contract_call_args['_to'] == '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913') && " +
//              "(eth.tx.contract_call_args['_targetEoA'] == '0x742d35cc6634c0532925a3b844bc9e7595f0beb') && " +
//              "eth.tx.contract_call_args['ethAmount'] <= 100000000000000000 && " +
//              "eth.tx.gasPrice <= 50000000000 && " +
//              "eth.tx.gas <= 500000",
//   notes: "Restricts which transactions the paymaster can execute on the gas station"
// }
```

**Note:** The `ensureGasStationInterface()` function uploads the Gas Station ABI to Turnkey's Smart Contract Interface feature. This enables Turnkey's policy engine to parse the ABI-encoded transaction data and directly compare the `ethAmount` parameter as a uint256 value, rather than raw bytes. The function checks if the ABI already exists before uploading to avoid duplicates.

#### Defense in Depth

Combine both policy types for maximum security:

```typescript
import {
  buildIntentSigningPolicy,
  buildPaymasterExecutionPolicy,
  DEFAULT_EXECUTION_CONTRACT,
} from "@turnkey/gas-station";
import { parseGwei } from "viem";

// Layer 1: EOA can only sign USDC intents
const eoaPolicy = buildIntentSigningPolicy({
  organizationId: "user-org",
  eoaUserId: "user-id",
  restrictions: {
    allowedContracts: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
    allowEthTransfer: false, // No ETH transfers
  },
});

// Layer 2: Paymaster can only execute for specific users with gas limits
const paymasterPolicy = buildPaymasterExecutionPolicy({
  organizationId: "paymaster-org",
  paymasterUserId: "paymaster-user-id",
  executionContractAddress: DEFAULT_EXECUTION_CONTRACT,
  restrictions: {
    allowedEOAs: ["0xUserAddress..."],
    allowedContracts: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
    maxGasPrice: parseGwei("50"),
    maxGasLimit: 500000n,
  },
});
```

### Advanced: Writing Custom Paymaster Policies

When using `buildPaymasterExecutionPolicy`, the SDK creates Turnkey policies that parse the transaction calldata to enforce restrictions. Understanding the transaction structure allows you to write custom policies for advanced use cases.

#### Transaction Data Structure

When the paymaster signs an execution transaction calling `execute(address _target, address _to, uint256 _ethAmount, bytes _data)`, the transaction data (`eth.tx.data`) has the following structure:

| Position in eth.tx.data | Length    | Content                | Example                                           |
| ----------------------- | --------- | ---------------------- | ------------------------------------------------- |
| `[2..10]`               | 8 chars   | Function selector      | `6c5c2ed9` (execute)                              |
| `[10..74]`              | 64 chars  | \_target (EOA, padded) | `0000...742d35cc6634c0532925a3b844bc9e7595f0beb`  |
| `[74..138]`             | 64 chars  | \_to (output contract) | `0000...833589fcd6edb6e08f4c7c32d4f71b54bda02913` |
| `[138..202]`            | 64 chars  | \_ethAmount (uint256)  | `0000...0000` (0 ETH) or amount in wei            |
| `[202..266]`            | 64 chars  | Offset to \_data bytes | `0000...0080` (128 bytes)                         |
| `[266..330]`            | 64 chars  | Packed data length     | `0000...0055` (85 bytes: 65+16+4)                 |
| `[330..460]`            | 130 chars | Signature (65 bytes)   | EIP-712 signature from EOA                        |
| `[460..492]`            | 32 chars  | Nonce (16 bytes)       | `00000000000000000000000000000000`                |
| `[492..500]`            | 8 chars   | Deadline (4 bytes)     | `6ac7d340` (Unix timestamp)                       |
| `[500+]`                | Variable  | Call data              | Encoded function call for target contract         |

**Important:** Turnkey's `eth.tx.data` includes the `0x` prefix, so positions start at index 2 (after `0x`).

**Note:** The deadline is a Unix timestamp that prevents replay attacks by expiring signatures after a specified time. The SDK defaults to 1 hour, customizable with `withDeadline()`.

#### Policy Conditions Reference

**Check execution contract address:**

```typescript
eth.tx.to == "0x576a4d741b96996cc93b4919a04c16545734481f";
```

**Check which EOA is executing:**

```typescript
eth.tx.data[10..74] == '0000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beb'
```

**Check target contract (output contract):**

```typescript
eth.tx.data[74..138] == '0000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913'
```

**Check ETH amount:**

```typescript
eth.tx.data[138..202].hex_to_uint() <= 100000000000000000; // Max 0.1 ETH in wei
```

**Check gas price:**

```typescript
eth.tx.gasPrice <= 50000000000; // 50 gwei in wei
```

**Check gas limit:**

```typescript
eth.tx.gas <= 500000;
```

#### Example: Custom Multi-Contract Policy

Allow paymaster to execute for USDC or DAI only:

```typescript
const policy = {
  organizationId: "paymaster-org-id",
  policyName: "Stablecoin Execution Policy",
  effect: "EFFECT_ALLOW",
  consensus: `approvers.any(user, user.id == '${paymasterUserId}')`,
  condition: [
    "activity.resource == 'PRIVATE_KEY'",
    "activity.action == 'SIGN'",
    "eth.tx.to == '0x576a4d741b96996cc93b4919a04c16545734481f'",
    // Allow USDC or DAI
    "(eth.tx.data[74..138] == '0000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913' || eth.tx.data[74..138] == '00000000000000000000006b175474e89094c44da98b954eedeac495271d0f')",
    // Gas limits
    "eth.tx.gasPrice <= 100000000000",
    "eth.tx.gas <= 500000",
  ].join(" && "),
  notes: "Allow USDC and DAI execution with gas limits",
};

await turnkeyClient.apiClient().createPolicy(policy);
```

#### Example: Whitelist Specific EOAs

Only allow execution for approved user wallets:

```typescript
const approvedEOAs = [
  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "0x1234567890123456789012345678901234567890",
];

const eoaConditions = approvedEOAs
  .map((addr) => {
    const padded = addr.slice(2).toLowerCase().padStart(64, "0");
    return `eth.tx.data[10..74] == '${padded}'`;
  })
  .join(" || ");

const policy = {
  organizationId: "paymaster-org-id",
  policyName: "Approved Users Only",
  effect: "EFFECT_ALLOW",
  consensus: `approvers.any(user, user.id == '${paymasterUserId}')`,
  condition: [
    "activity.resource == 'PRIVATE_KEY'",
    "activity.action == 'SIGN'",
    "eth.tx.to == '0x576a4d741b96996cc93b4919a04c16545734481f'",
    `(${eoaConditions})`,
  ].join(" && "),
};

await turnkeyClient.apiClient().createPolicy(policy);
```

#### Using the Helper Functions

For most cases, use the built-in helpers which handle the byte positions correctly:

```typescript
import {
  buildPaymasterExecutionPolicy,
  DEFAULT_EXECUTION_CONTRACT,
} from "@turnkey/gas-station";
import { parseGwei } from "viem";

const policy = buildPaymasterExecutionPolicy({
  organizationId: subOrgId,
  paymasterUserId: paymasterUserId,
  executionContractAddress: DEFAULT_EXECUTION_CONTRACT,
  restrictions: {
    allowedContracts: [
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
      "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI
    ],
    allowedEOAs: ["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"],
    maxGasPrice: parseGwei("100"),
    maxGasLimit: 500000n,
  },
  policyName: "Production Paymaster Policy",
});

await turnkeyClient.apiClient().createPolicy(policy);
```

The helper functions automatically:

- Convert addresses to lowercase
- Add proper padding for EOA addresses
- Calculate correct byte positions (accounting for `0x` prefix)
- Generate proper OR conditions for multiple allowed values

## Troubleshooting

### Authorization Failed

- Ensure paymaster has ETH for gas
- Verify delegate contract address is correct
- Check EOA hasn't already been authorized

### Execution Failed

- Confirm EOA is authorized (check with `isAuthorized()`)
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
