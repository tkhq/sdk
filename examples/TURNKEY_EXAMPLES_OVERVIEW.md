# Turnkey SDK Examples Overview

This document provides a comprehensive overview of all examples in the Turnkey SDK repository, detailing what features each example showcases and their Turnkey package dependencies.

## Dependencies Table

| Example | sdk-server | http | api-key-stamper | sdk-react | ethers | viem | solana | webauthn-stamper | sdk-browser | crypto | encoding | sdk-types | wallet-stamper | iframe-stamper | cosmjs | eip-1193-provider | indexed-db-stamper | react-wallet-kit | sdk-js | Total |
|---------|------------|------|-----------------|-----------|--------|------|--------|------------------|-------------|--------|----------|-----------|----------------|----------------|--------|-------------------|--------------------|--------------------|--------|-------|
| with-ethers | ✓ | ✓ | ✓ | | ✓ | | | | | | | | | | | | | | | 4 |
| with-viem | ✓ | ✓ | ✓ | | | ✓ | | | | | | | | | | | | | | 4 |
| with-gnosis | ✓ | | | | ✓ | | | | | | | | | | | | | | | 2 |
| with-eip-1193-provider | ✓ | ✓ | ✓ | ✓ | | | | ✓ | | | | | | | | ✓ | | | | 6 |
| with-solana | ✓ | ✓ | ✓ | | | | ✓ | | | | | | | | | | | | | 4 |
| with-bitcoin | ✓ | ✓ | | | | | | | | | | | | | | | | | | 2 |
| with-aptos | ✓ | ✓ | | | | | | | | | | | | | | | | | | 2 |
| with-cosmjs | ✓ | ✓ | | | | | | | | | | | | | ✓ | | | | | 3 |
| with-movement | ✓ | ✓ | | | | | | | | | | | | | | | | | | 2 |
| with-sui | ✓ | ✓ | | | | | | | | | | | | | | | | | | 2 |
| with-ton | ✓ | ✓ | | | | | | | | | | | | | | | | | | 2 |
| with-tron | ✓ | ✓ | ✓ | | | | | | | ✓ | | | | | | | | | | 4 |
| email-auth | ✓ | | | ✓ | | | | | | | | | | | | | | | | 2 |
| email-auth-local-storage | ✓ | ✓ | | | | | | | | ✓ | ✓ | | | | | | | | | 4 |
| otp-auth | ✓ | | | ✓ | | | | | | | | | | | | | | | | 2 |
| v2/with-otp-auth | | | | | | | | | | | | | | | | | | ✓ | | 1 |
| oauth | ✓ | | | ✓ | | | | | | | | | | | | | | | | 2 |
| with-indexed-db | ✓ | | | ✓ | | | | | | | | ✓ | | | | | | | | 3 |
| with-federated-passkeys | ✓ | ✓ | ✓ | ✓ | | | | ✓ | ✓ | | | | | | | | | | | 6 |
| with-eth-passkeys-galore | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | | | | | | | | | | | 8 |
| with-solana-passkeys | ✓ | ✓ | ✓ | ✓ | | | ✓ | ✓ | ✓ | | | | | | | | | | | 7 |
| with-biconomy-aa | ✓ | | | | ✓ | ✓ | | | | | | | | | | | | | | 3 |
| with-zerodev-aa | ✓ | | | | ✓ | ✓ | | | | | | | | | | | | | | 3 |
| with-uniswap | ✓ | | | | ✓ | | | | | | | | | | | | | | | 2 |
| trading-runner | ✓ | | | | ✓ | | | | | | | | | | | | | | | 2 |
| sweeper | ✓ | | | | ✓ | | | | | | | | | | | | | | | 2 |
| rebalancer | ✓ | | | | ✓ | | | | | | | | | | | | | | | 2 |
| deployer | ✓ | | | | ✓ | | | | | | | | | | | | | | | 2 |
| wallet-import-export | ✓ | | | | | | | | | | | | | ✓ | | | | | | 2 |
| export-in-node | ✓ | | | | | | | | | ✓ | ✓ | | | | | | | | | 3 |
| import-in-node | ✓ | | | | | | | | | ✓ | ✓ | | | | | | | | | 3 |
| with-nonce-manager | ✓ | | | | ✓ | | | | | | | | | | | | | | | 2 |
| with-offline | | ✓ | ✓ | | | | | | | | | | | | | | | | | 2 |
| delegated-access | ✓ | | | | | | | | | | | | | | | | | | | 1 |
| with-wallet-stamper | | ✓ | ✓ | | | ✓ | ✓ | ✓ | | | ✓ | | ✓ | | | | | | | 7 |
| react-components | ✓ | | | ✓ | | | | | ✓ | | | | ✓ | | | | ✓ | | | 5 |
| react-wallet-kit | ✓ | | | ✓ | | | | | | | | ✓ | ✓ | | | | | ✓ | ✓ | 6 |
| with-sdk-js | ✓ | | | ✓ | | | | | | | | ✓ | ✓ | | | | | ✓ | ✓ | 6 |
| with-sdk-server | ✓ | | | | | | | | | | | | | | | | | | | 1 |
| kitchen-sink | ✓ | ✓ | ✓ | ✓ | | | | | ✓ | | | | | | | | | | | 5 |
| **Total Usage** | **31** | **16** | **11** | **11** | **9** | **4** | **3** | **5** | **5** | **3** | **3** | **3** | **4** | **1** | **1** | **1** | **1** | **2** | **2** | |

## Blockchain Integration Examples

### Ethereum & EVM-Compatible Chains

#### **with-ethers**
- **Features**: Ethereum transaction construction and broadcasting using Ethers.js, EIP-1559 transactions, WETH wrapping, raw payload signing
- **Turnkey Dependencies**: 
  - `@turnkey/api-key-stamper`
  - `@turnkey/ethers`
  - `@turnkey/http`
  - `@turnkey/sdk-server`

#### **with-viem**
- **Features**: Transaction construction and signing using Viem library, support for various EIP standards (EIP-1559, EIP-4844, EIP-7702)
- **Turnkey Dependencies**: 
  - `@turnkey/api-key-stamper`
  - `@turnkey/http`
  - `@turnkey/sdk-server`
  - `@turnkey/viem`

#### **with-gnosis**
- **Features**: Gnosis Safe multisig creation and management, 3/3 multisig transactions, offchain and onchain approvals
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`
  - `@turnkey/ethers`

#### **with-eip-1193-provider**
- **Features**: EIP-1193 provider implementation for dApp integration, WebAuthn authentication
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`
  - `@turnkey/sdk-react`
  - `@turnkey/api-key-stamper`
  - `@turnkey/eip-1193-provider`
  - `@turnkey/http`
  - `@turnkey/webauthn-stamper`

### Non-EVM Blockchains

#### **with-solana**
- **Features**: Solana wallet creation, transaction signing, SPL token operations, policy engine support for token transfers
- **Turnkey Dependencies**: 
  - `@turnkey/api-key-stamper`
  - `@turnkey/http`
  - `@turnkey/sdk-server`
  - `@turnkey/solana`

#### **with-bitcoin**
- **Features**: Bitcoin transaction construction and broadcasting, P2TR and P2WPKH address formats
- **Turnkey Dependencies**: 
  - `@turnkey/http`
  - `@turnkey/sdk-server`

#### **with-aptos**
- **Features**: Aptos blockchain transaction construction and signing
- **Turnkey Dependencies**: 
  - `@turnkey/http`
  - `@turnkey/sdk-server`

#### **with-cosmjs**
- **Features**: Cosmos blockchain transactions using CosmJS, Celestia testnet integration
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`
  - `@turnkey/cosmjs`
  - `@turnkey/http`

#### **with-movement**
- **Features**: Movement blockchain transaction construction and signing
- **Turnkey Dependencies**: 
  - `@turnkey/http`
  - `@turnkey/sdk-server`

#### **with-sui**
- **Features**: Sui blockchain transaction construction and signing
- **Turnkey Dependencies**: 
  - `@turnkey/http`
  - `@turnkey/sdk-server`

#### **with-ton**
- **Features**: TON blockchain transaction construction and signing
- **Turnkey Dependencies**: 
  - `@turnkey/http`
  - `@turnkey/sdk-server`

#### **with-tron**
- **Features**: TRON blockchain transactions, TRX and TRC-20 token transfers with policies
- **Turnkey Dependencies**: 
  - `@turnkey/api-key-stamper`
  - `@turnkey/crypto`
  - `@turnkey/http`
  - `@turnkey/sdk-server`

## Authentication Examples

### Email Authentication

#### **email-auth**
- **Features**: Complete email authentication flow with NextJS, iframe-based stamping, frontend and backend integration
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`
  - `@turnkey/sdk-react`

#### **email-auth-local-storage**
- **Features**: Email authentication with locally stored target embedded key, no iframe required
- **Turnkey Dependencies**: 
  - `@turnkey/crypto`
  - `@turnkey/encoding`
  - `@turnkey/http`
  - `@turnkey/sdk-server`

### OTP Authentication

#### **otp-auth**
- **Features**: One-Time Password authentication flow, IndexedDB client for request stamping
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`
  - `@turnkey/sdk-react`

### OAuth

#### **oauth**
- **Features**: Complete OAuth flow with Google integration, IndexedDB client for request stamping
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`
  - `@turnkey/sdk-react`

### Passkey Authentication

#### **with-indexed-db**
- **Features**: Passkey authentication with persistent session storage using unextractable IndexedDB keys
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`
  - `@turnkey/sdk-react`
  - `@turnkey/sdk-types`

#### **with-federated-passkeys**
- **Features**: Sub-organization creation with passkey-based authentication, WebAuthn integration
- **Turnkey Dependencies**: 
  - `@turnkey/http`
  - `@turnkey/api-key-stamper`
  - `@turnkey/webauthn-stamper`
  - `@turnkey/sdk-browser`
  - `@turnkey/sdk-react`
  - `@turnkey/sdk-server`

#### **with-eth-passkeys-galore**
- **Features**: Ethereum transactions with passkey signing, sub-organization management, account abstraction with Biconomy
- **Turnkey Dependencies**: 
  - `@turnkey/api-key-stamper`
  - `@turnkey/ethers`
  - `@turnkey/http`
  - `@turnkey/sdk-browser`
  - `@turnkey/sdk-react`
  - `@turnkey/sdk-server`
  - `@turnkey/viem`
  - `@turnkey/webauthn-stamper`

#### **with-solana-passkeys**
- **Features**: Solana transactions with passkey authentication and sub-organizations
- **Turnkey Dependencies**: 
  - `@turnkey/api-key-stamper`
  - `@turnkey/http`
  - `@turnkey/sdk-browser`
  - `@turnkey/sdk-react`
  - `@turnkey/sdk-server`
  - `@turnkey/solana`
  - `@turnkey/webauthn-stamper`

## Account Abstraction Examples

#### **with-biconomy-aa**
- **Features**: Account abstraction with Biconomy paymaster integration, smart wallet transactions
- **Turnkey Dependencies**: 
  - `@turnkey/ethers`
  - `@turnkey/sdk-server`
  - `@turnkey/viem`

#### **with-zerodev-aa**
- **Features**: Account abstraction with ZeroDev integration
- **Turnkey Dependencies**: 
  - `@turnkey/ethers`
  - `@turnkey/sdk-server`
  - `@turnkey/viem`

## DeFi & Trading Examples

#### **with-uniswap**
- **Features**: Uniswap DEX trading and transaction construction
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`
  - `@turnkey/ethers`

#### **trading-runner**
- **Features**: Advanced trading operations with policies, user management, and Uniswap integration
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`
  - `@turnkey/ethers`

#### **sweeper**
- **Features**: Multi-asset fund sweeping (tokens + native ETH), automated balance management
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`
  - `@turnkey/ethers`

#### **rebalancer**
- **Features**: Multi-user key management, policy-based access control, consensus-based transaction approval
- **Turnkey Dependencies**: 
  - `@turnkey/ethers`
  - `@turnkey/sdk-server`

## Smart Contract Examples

#### **deployer**
- **Features**: Smart contract deployment using Turnkey signers, Solidity compilation and deployment workflow
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`
  - `@turnkey/ethers`

## Wallet Management Examples

#### **wallet-import-export**
- **Features**: Wallet import and export functionality, mnemonic phrase handling, iframe-based secure operations
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`
  - `@turnkey/iframe-stamper`

#### **export-in-node**
- **Features**: Secure export of private keys, wallets, and accounts with HPKE encryption
- **Turnkey Dependencies**: 
  - `@turnkey/crypto`
  - `@turnkey/encoding`
  - `@turnkey/sdk-server`

#### **import-in-node**
- **Features**: Secure import of private keys and wallets with HPKE encryption
- **Turnkey Dependencies**: 
  - `@turnkey/crypto`
  - `@turnkey/encoding`
  - `@turnkey/sdk-server`

## Advanced Features Examples

#### **with-nonce-manager**
- **Features**: Advanced nonce management for Ethereum transactions with retry logic
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`
  - `@turnkey/ethers`

#### **with-offline**
- **Features**: Offline transaction signing and request preparation
- **Turnkey Dependencies**: 
  - `@turnkey/api-key-stamper`
  - `@turnkey/http`

#### **delegated-access**
- **Features**: Delegated access setup with sub-organizations, policies, and user management
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`

#### **with-wallet-stamper**
- **Features**: Wallet stamper usage for transaction signing
- **Turnkey Dependencies**: 
  - `@turnkey/api-key-stamper`
  - `@turnkey/encoding`
  - `@turnkey/http`
  - `@turnkey/solana`
  - `@turnkey/viem`
  - `@turnkey/wallet-stamper`
  - `@turnkey/webauthn-stamper`

## UI Component Examples

#### **react-components**
- **Features**: React components showcase, OAuth integration (Google, Facebook, Apple), passkey authentication, wallet import/export
- **Turnkey Dependencies**: 
  - `@turnkey/indexed-db-stamper`
  - `@turnkey/sdk-browser`
  - `@turnkey/sdk-react`
  - `@turnkey/sdk-server`
  - `@turnkey/wallet-stamper`

#### **react-wallet-kit**
- **Features**: React wallet kit demo and components showcase
- **Turnkey Dependencies**: 
  - `@turnkey/react-wallet-kit`
  - `@turnkey/sdk-js`
  - `@turnkey/sdk-react`
  - `@turnkey/sdk-server`
  - `@turnkey/sdk-types`
  - `@turnkey/wallet-stamper`

## SDK Usage Examples

#### **with-sdk-js**
- **Features**: Browser-based SDK usage with React integration
- **Turnkey Dependencies**: 
  - `@turnkey/react-wallet-kit`
  - `@turnkey/sdk-js`
  - `@turnkey/sdk-react`
  - `@turnkey/sdk-server`
  - `@turnkey/sdk-types`
  - `@turnkey/wallet-stamper`

#### **with-sdk-server**
- **Features**: Basic server SDK usage and API calls (Whoami request)
- **Turnkey Dependencies**: 
  - `@turnkey/sdk-server`

#### **kitchen-sink**
- **Features**: Comprehensive example bank showing multiple SDK approaches
- **Turnkey Dependencies**: 
  - `@turnkey/http`
  - `@turnkey/api-key-stamper`
  - `@turnkey/sdk-server`
  - `@turnkey/sdk-react`
  - `@turnkey/sdk-browser`

## UI Framework Overview

| Example | UI Type | Framework Version | Router Type | UI Libraries | Notes |
|---------|---------|-------------------|-------------|--------------|-------|
| **Next.js with App Router** |||||
| react-components | Next.js | 14.2.25 / React 18.2.0 | App Router | Material-UI 6.1.5 | Component showcase with MUI |
| react-wallet-kit | Next.js | 14.2.25 / React 18.2.0 | App Router | Three.js, Tailwind CSS | 3D wallet visualization |
| with-indexed-db | Next.js | 14.2.25 / React 18.2.0 | App Router | - | IndexedDB passkey storage |
| with-sdk-js | Next.js | 14.2.25 / React 18.2.0 | App Router | - | SDK demo with social auth |
| with-eip-1193-provider | Next.js | 14.2.25 / React 18.0 | App Router | Radix UI, Tailwind CSS | EIP-1193 provider interface |
| with-wallet-stamper | Next.js | 14.2.25 / React 18.3.1 | App Router | Radix UI, Tailwind CSS | Wallet stamper with Solana |
| v2/with-otp-auth | Next.js | **15.4.3** / React **19.1.0** | App Router | Tailwind CSS v4 | Latest Next.js/React versions |
| **Next.js with Pages Router** |||||
| email-auth | Next.js | 14.2.25 / React 18.2.0 | Pages Router | - | Email authentication flow |
| email-auth-local-storage | Next.js | 14.2.25 / React 18.2.0 | Pages Router | - | Email auth with local storage |
| otp-auth | Next.js | 14.2.25 / React 18.2.0 | Pages Router | - | OTP authentication flow |
| oauth | Next.js | 14.2.25 / React 18.2.0 | Pages Router | - | OAuth with Google integration |
| with-federated-passkeys | Next.js | 14.2.25 / React 18.2.0 | Pages Router | - | Federated passkey auth |
| with-eth-passkeys-galore | Next.js | 14.2.25 / React 18.2.0 | Pages Router | - | Ethereum passkeys demo |
| with-solana-passkeys | Next.js | 14.2.25 / React 18.2.0 | Pages Router | - | Solana passkeys interface |
| wallet-import-export | Next.js | 14.2.25 / React 18.2.0 | Pages Router | - | Import/export wallet UI |
| **CLI/Backend (No UI)** |||||
| with-ethers | None | - | - | - | CLI tool for Ethereum |
| with-viem | None | - | - | - | CLI tool with Viem |
| with-gnosis | None | - | - | - | CLI for Gnosis Safe |
| with-solana | None | - | - | - | CLI for Solana operations |
| with-bitcoin | None | - | - | - | CLI for Bitcoin transactions |
| with-aptos | None | - | - | - | CLI for Aptos blockchain |
| with-cosmjs | None | - | - | - | CLI for Cosmos chains |
| with-movement | None | - | - | - | CLI for Movement blockchain |
| with-sui | None | - | - | - | CLI for Sui blockchain |
| with-ton | None | - | - | - | CLI for TON blockchain |
| with-tron | None | - | - | - | CLI for TRON blockchain |
| with-biconomy-aa | None | - | - | - | CLI for account abstraction |
| with-zerodev-aa | None | - | - | - | CLI for ZeroDev AA |
| with-uniswap | None | - | - | - | CLI for Uniswap trading |
| trading-runner | None | - | - | - | CLI trading automation |
| sweeper | None | - | - | - | CLI token sweeper |
| rebalancer | None | - | - | - | CLI portfolio rebalancer |
| deployer | None | - | - | - | CLI contract deployment |
| export-in-node | None | - | - | - | CLI export utility |
| import-in-node | None | - | - | - | CLI import utility |
| with-nonce-manager | None | - | - | - | CLI nonce management |
| with-offline | None | - | - | - | CLI offline signing |
| delegated-access | None | - | - | - | CLI delegated access |
| with-sdk-server | None | - | - | - | CLI server SDK demo |
| kitchen-sink | None | - | - | - | CLI comprehensive examples |

### UI Framework Summary

- **Total Examples with UI**: 15 (37.5%)
- **Total CLI/Backend Examples**: 25 (62.5%)
- **Next.js App Router**: 7 examples (modern approach)
- **Next.js Pages Router**: 8 examples (legacy approach)
- **Latest Framework Versions**: v2/with-otp-auth uses Next.js 15.4.3 and React 19.1.0
- **Most Common UI Libraries**: Tailwind CSS, Radix UI, Material-UI

### Key Insights

1. **Router Migration**: Newer examples are adopting Next.js App Router over Pages Router
2. **Version Standardization**: Most examples use Next.js 14.2.25 and React 18.2.0
3. **Authentication Focus**: UI examples primarily demonstrate authentication methods
4. **CLI Dominance**: Majority of examples are CLI tools for blockchain integrations
5. **Modern Stack**: v2/with-otp-auth represents the most modern tech stack

## Package Dependency Summary

### Most Used Packages
1. `@turnkey/sdk-server` - Used in 31 examples
2. `@turnkey/http` - Used in 16 examples
3. `@turnkey/api-key-stamper` - Used in 11 examples
4. `@turnkey/sdk-react` - Used in 11 examples
5. `@turnkey/ethers` - Used in 9 examples

### Authentication Packages
- `@turnkey/webauthn-stamper` - WebAuthn/Passkey authentication
- `@turnkey/iframe-stamper` - Iframe-based secure operations
- `@turnkey/indexed-db-stamper` - IndexedDB storage
- `@turnkey/wallet-stamper` - Wallet-based stamping

### Blockchain-Specific Packages
- `@turnkey/ethers` - Ethereum/EVM chains with Ethers.js
- `@turnkey/viem` - Ethereum/EVM chains with Viem
- `@turnkey/solana` - Solana blockchain
- `@turnkey/cosmjs` - Cosmos ecosystem
- `@turnkey/eip-1193-provider` - EIP-1193 compliant provider

### Core Infrastructure Packages
- `@turnkey/crypto` - Cryptographic operations
- `@turnkey/encoding` - Encoding utilities
- `@turnkey/sdk-browser` - Browser SDK
- `@turnkey/sdk-types` - TypeScript type definitions
- `@turnkey/react-wallet-kit` - React wallet components kit