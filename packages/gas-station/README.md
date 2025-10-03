# @turnkey/gas-station

Turnkey Gas Station SDK for EIP-7702 delegated execution and paymaster functionality.

## Overview

This package provides utilities for building gas station applications using Turnkey's infrastructure. It includes:

- **GasStationClient**: Main client for managing EIP-7702 authorizations and intent execution
- **IntentBuilder**: Fluent API for building and signing execution intents
- **Policy Utilities**: Tools for creating Turnkey policies to restrict signing and execution
- **Chain Presets**: Pre-configured settings for popular EVM chains

## Installation

```bash
npm install @turnkey/gas-station
```

## Quick Start

```typescript
import { GasStationClient, CHAIN_PRESETS } from "@turnkey/gas-station";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";

// Create a wallet client
const walletClient = createWalletClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
  // ... your account configuration
});

// Create gas station client
const gasStation = new GasStationClient({
  walletClient,
  explorerUrl: "https://basescan.org",
});

// Sign an authorization
const authorization = await gasStation.signAuthorization();

// Execute an intent
const intent = await gasStation
  .createIntent()
  .transferToken(USDC_ADDRESS, recipient, amount)
  .sign(nonce);

await gasStation.execute(intent);
```

## API Reference

### GasStationClient

Main client for gas station operations.

#### Methods

- `signAuthorization()`: Sign an EIP-7702 authorization
- `submitAuthorization(authorization)`: Submit a signed authorization
- `authorize(paymasterClient)`: Combined sign and submit flow
- `getNonce(address?)`: Get current nonce for an address
- `createIntent()`: Create an intent builder
- `execute(intent)`: Execute a signed intent
- `signExecution(intent)`: Sign execution without broadcasting

### IntentBuilder

Fluent API for building execution intents.

#### Methods

- `setTarget(contract)`: Set target contract
- `withValue(amount)`: Set ETH value
- `withNonce(nonce)`: Set specific nonce
- `callContract(params)`: Add contract call
- `transferToken(token, to, amount)`: ERC20 transfer
- `approveToken(token, spender, amount)`: ERC20 approval
- `transferETH(to, amount)`: Native ETH transfer
- `sign(nonce)`: Sign the intent

### Policy Utilities

Create Turnkey policies for security restrictions.

#### Functions

- `buildIntentSigningPolicy(config)`: Policy for EOA signing restrictions
- `buildPaymasterExecutionPolicy(config)`: Policy for paymaster execution restrictions

## Chain Presets

Pre-configured settings for popular chains:

- `BASE_MAINNET`: Base mainnet configuration
- `ETHEREUM_MAINNET`: Ethereum mainnet configuration
- `SEPOLIA`: Sepolia testnet configuration

## License

MIT

