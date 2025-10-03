# @turnkey/gas-station

Turnkey Gas Station SDK for EIP-7702 delegated execution and paymaster functionality.

## Overview

This package provides a complete SDK for building gasless transaction applications using EIP-7702 and Turnkey's secure wallet infrastructure. It includes:

- **GasStationClient**: Main client for managing EIP-7702 authorizations and intent execution
- **IntentBuilder**: Fluent API for building and signing execution intents
- **Policy Utilities**: Tools for creating Turnkey policies to restrict signing and execution
- **Chain Presets**: Pre-configured settings for popular EVM chains

## Installation

```bash
npm install @turnkey/gas-station @turnkey/sdk-server @turnkey/viem viem
```

## Quick Start

```typescript
import { GasStationClient, CHAIN_PRESETS } from "@turnkey/gas-station";
import { Turnkey } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import { createWalletClient, http, parseUnits } from "viem";
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

// Create wallet clients
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

// Create gas station clients
const userClient = new GasStationClient({
  walletClient: userWalletClient,
  explorerUrl: "https://basescan.org",
});

const paymasterClient = new GasStationClient({
  walletClient: paymasterWalletClient,
  explorerUrl: "https://basescan.org",
});

// One-time authorization
await userClient.authorize(paymasterClient);

// Execute gasless USDC transfer
const nonce = await userClient.getNonce();
const intent = await userClient
  .createIntent()
  .transferToken(
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    recipientAddress,
    parseUnits("10", 6)
  )
  .sign(nonce);

await paymasterClient.execute(intent);
```

## API Reference

### GasStationClient

Main client for gas station operations. Each client instance wraps a viem wallet client.

#### Constructor

```typescript
new GasStationClient({
  walletClient: WalletClient,          // Viem wallet client with Turnkey account
  explorerUrl: string,                 // Block explorer URL for transaction links
  delegateContract?: `0x${string}`,    // Optional: defaults to deterministic address
  executionContract?: `0x${string}`,   // Optional: defaults to deterministic address
})
```

#### Methods

**End User Methods** (call with user client):

- `signAuthorization()`: Sign an EIP-7702 authorization for the gas station contract
- `createIntent()`: Create a builder for composing transactions
- `getNonce(address?)`: Get current nonce from gas station contract
- `isDelegated(address?)`: Check if an EOA has delegated control

**Paymaster Methods** (call with paymaster client):

- `submitAuthorization(authorization)`: Submit a signed EIP-7702 authorization transaction
- `execute(intent)`: Execute a signed intent through the gas station
- `signExecution(intent)`: Sign execution without broadcasting (for testing)

**Convenience Methods** (require both clients):

- `authorize(paymasterClient)`: Combined flow - user signs authorization, paymaster submits

### IntentBuilder

Fluent API for building execution intents. Created via `gasStationClient.createIntent()`.

#### Methods

- `transferToken(token, to, amount)`: ERC20 token transfer
- `approveToken(token, spender, amount)`: ERC20 token approval
- `transferETH(to, amount)`: Native ETH transfer
- `callContract(params)`: Generic contract call with `{ contract, abi, functionName, args, value? }`
- `setTarget(contract)`: Set target contract address
- `withValue(amount)`: Set ETH value to send
- `withNonce(nonce)`: Set specific nonce (optional)
- `withCallData(callData)`: Set pre-encoded call data
- `sign(nonce)`: Sign the intent and return `ExecutionIntent`

### Policy Utilities

Create Turnkey policies for security restrictions at both the signing and execution layers.

#### buildIntentSigningPolicy(config)

Restricts what EIP-712 intents an EOA can sign.

```typescript
buildIntentSigningPolicy({
  organizationId: string,
  eoaUserId: string,
  restrictions: {
    allowedContracts?: `0x${string}`[],
    maxEthAmount?: bigint,
  },
  policyName?: string,
})
```

#### buildPaymasterExecutionPolicy(config)

Restricts what on-chain transactions the paymaster can execute.

```typescript
buildPaymasterExecutionPolicy({
  organizationId: string,
  paymasterUserId: string,
  executionContractAddress: `0x${string}`,
  restrictions?: {
    allowedEOAs?: `0x${string}`[],
    allowedContracts?: `0x${string}`[],
    maxGasPrice?: bigint,
    maxGasLimit?: bigint,
  },
  policyName?: string,
})
```

## Chain Presets

Pre-configured settings for popular chains:

```typescript
import {
  CHAIN_PRESETS,
  getPreset,
  createCustomPreset,
} from "@turnkey/gas-station";

// Available presets
const baseMainnet = CHAIN_PRESETS.BASE_MAINNET;
const ethMainnet = CHAIN_PRESETS.ETHEREUM_MAINNET;
const sepolia = CHAIN_PRESETS.SEPOLIA;

// Get preset with overrides
const preset = getPreset("BASE_MAINNET", {
  rpcUrl: "https://custom-rpc.com",
});

// Create custom preset
const customPreset = createCustomPreset({
  chain: myChain,
  rpcUrl: "https://my-rpc.com",
  explorerUrl: "https://my-explorer.com",
  tokens: {
    USDC: "0x...",
  },
});
```

Each preset includes:

- `chain`: Viem chain object
- `rpcUrl`: RPC endpoint URL
- `explorerUrl`: Block explorer URL
- `tokens`: Common token addresses (e.g., USDC)

## Examples

See the `/examples/tk-gas-station` directory for complete working examples including:

- ETH transfers
- USDC transfers
- Policy enforcement testing
- Multi-step transactions

## License

MIT
