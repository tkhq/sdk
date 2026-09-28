# Example: `with-abi-policy-control`

A proof-of-concept demonstrating how to use Turnkey to create isolated merchant deposit wallets with automated USDC sweeping and strict policy enforcement.

## Overview

This demo shows how Turnkey enables fintech platforms to:

- Create dedicated deposit wallets for merchants on demand
- Automatically sweep incoming USDC deposits into a central treasury (omnibus) wallet
- Enforce strict controls so that only USDC can be moved, and only to the treasury

Using **Sub-Organizations**, **Delegated Access**, the **Policy Engine**, and **Smart Contract Interfaces**, all operations remain under strict policy control.

## What It Demonstrates

- **ABI upload** — each merchant sub-org registers the USDC ABI as a Smart Contract Interface, so the policy engine can decode `transfer(to, amount)` calldata
- **Policy on decoded arguments** — the delegated key is allowed to sign only when `eth.tx.contract_call_args['to']` equals the treasury address
- **Gas sponsorship** — sweeps are sponsored by Turnkey, so merchant wallets never need to hold ETH
- **Negative tests** — `malicious` tries a native ETH send and a USDC transfer to the wrong recipient; the policy engine rejects both before signing

The demo runs on Sepolia by default and works on any Turnkey-supported EVM chain via `TURNKEY_CAIP2`.

## Turnkey Primitives Used

| Primitive                     | Usage                                                              | Why It Was Chosen                                                    |
| ----------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **Sub-Organizations**         | Create isolated wallets + policies per merchant                    | Provides strong isolation between merchants                          |
| **Delegated Access**          | Server-side signing using a restricted API key                     | Enables automated sweeping without exposing merchant keys            |
| **Smart Contract Interfaces** | Register USDC ABI so policy engine can decode contract calls       | Allows policies to inspect decoded arguments like transfer recipient |
| **Policy Engine**             | Restrict actions to only allow USDC transfers to the treasury      | Enforces security rules at the API level before signing              |
| **Root Quorum Management**    | Remove delegated key from root quorum after setup                  | Reduces blast radius if the delegated key is compromised             |
| **Gas Sponsorship**           | Turnkey covers gas fees for sweep transactions                     | Eliminates need for merchants to hold ETH                            |
| **Transaction Management**    | Turnkey builds, signs, broadcasts, and polls the sweep transaction | No nonce/gas handling or RPC node to run                             |
| **Balances API**              | Read merchant native + USDC balances from Turnkey                  | No public RPC node or indexer dependency                             |

## Key Assumptions & Simplifications

- Runs on **Sepolia testnet** by default (not mainnet)
- Balances and transactions go through Turnkey — no RPC node or indexer is configured
- One delegated API key is used across all merchants
- Policy enforcement happens at the Turnkey API layer
- Sweeping is triggered manually via `sweepAll` (production systems could use webhooks or scheduled jobs)
- Sub-org filtering is based on name prefix (`SUBORG_PREFIX`)

## Features

- Interactive CLI for merchant lifecycle management
- On-demand merchant wallet creation with automatic policy setup
- Full USDC balance sweeping to treasury (not hardcoded amounts, gas sponsored by Turnkey)
- Positive and negative test flows
- Optional ETH funding for testing malicious transaction blocking

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/access-control/with-abi-policy-control/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for the Turnkey parent organization
- A public/private API key pair for the delegated account
- An organization ID
- A treasury wallet address in the parent organization to receive USDC sweeps

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `TURNKEY_API_PUBLIC_KEY` / `TURNKEY_API_PRIVATE_KEY` — parent org root credentials
- `TURNKEY_BASE_URL` — Turnkey API base URL (default `https://api.turnkey.com`)
- `TURNKEY_ORGANIZATION_ID` — parent org ID
- `DELEGATED_API_PUBLIC_KEY` / `DELEGATED_API_PRIVATE_KEY` — delegated key for sweeping
- `TREASURY_ADDRESS` — recipient address for USDC sweeps
- `USDC_CONTRACT` — USDC contract address (Sepolia: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`)
- `TURNKEY_CAIP2` — chain to run on (default `eip155:11155111`, Sepolia). Any Turnkey-supported EVM chain works; set `USDC_CONTRACT` to that chain's USDC.
- `TURNKEY_SPONSOR` — gas sponsorship, on by default (set `false` to make merchants pay their own gas)

### 3/ Running the demo

```bash
pnpm start
```

### Available Commands

| Command               | Description                                       |
| --------------------- | ------------------------------------------------- |
| `create <name>`       | Create a new merchant (sub-org + wallet + policy) |
| `fund <number> [eth]` | Fund a merchant with ETH (for negative tests)     |
| `sweepAll`            | Sweep the full USDC balance of all merchants      |
| `malicious <number>`  | Run negative tests on a merchant                  |
| `list`                | List all created merchants                        |
| `exit`                | Quit the demo                                     |

### Example Flow

```text
> create Cambria
✅ Merchant "Cambria" created
   Sub-org ID:      d8db7593-0d2c-437a-99b2-91b4d78c8d6f
   Deposit Address: 0x5aF...

> sweepAll
--- Cambria ---
   USDC balance: 20
   ✅ Swept 20 USDC → Tx: 0xabc...

> fund 1
   ✅ Funded 0.003 ETH to merchant → Tx: 0xdef...

> malicious 1
   ❌ Testing malicious ETH send to treasury...
   ✅ Policy correctly blocked non-USDC transfer
   ❌ Testing USDC to wrong recipient...
   ✅ Policy correctly blocked wrong recipient

> exit
Goodbye!
```

Each blocked transaction is rejected by Turnkey's policy engine (`No policies evaluated to outcome: Allow`) before anything is signed or broadcast.

## Architecture

### Merchant Creation Flow

Each merchant creation follows these steps:

1. **Create Sub-Organization** — Isolated org with delegated API key + merchant root user
2. **Create Wallet** — Dedicated deposit address for the merchant
3. **Register Smart Contract Interface** — Upload USDC ABI so policies can decode contract calls
4. **Create Restrictive Policy** — Only allow USDC transfers to the treasury address
5. **Remove Delegation from Quorum** — The merchant root user becomes the only root; the delegated key keeps only what the policy allows

### Policy Enforcement

The restrictive policy enforces:

- Only calls to the USDC contract (`transfer()` function)
- Only when the decoded recipient address equals the treasury
- Even if the delegated key leaks, it can **only** sweep USDC to the treasury

### Sub-Organization Filtering

On startup the CLI loads existing merchants by:

1. Listing all sub-orgs of the parent org
2. Keeping those whose organization name starts with `SUBORG_PREFIX`
3. Reading each one's deposit wallet account (skipping sub-orgs with no readable wallet)

This ensures only merchants created by this demo are loaded.

## References

- [Turnkey Delegated Access Pattern](https://docs.turnkey.com/features/policies/delegated-access/overview)
- [Policy Engine Quickstart](https://docs.turnkey.com/features/policies/quickstart)
- [Smart Contract Interfaces](https://docs.turnkey.com/features/policies/smart-contract-interfaces)
- [Sub-Organizations API](https://docs.turnkey.com/api-reference/activities/create-sub-organization)
- [Update Root Quorum API](https://docs.turnkey.com/api-reference/activities/update-root-quorum)
- [Transaction Management](https://docs.turnkey.com/features/transaction-management)
- [Balances API](https://docs.turnkey.com/features/transaction-management/balances)

## Files

- `src/index.ts` — Interactive CLI demo
- `tsconfig.json` — TypeScript configuration
- `.env.local.example` — Environment template
- `README.md` — This file
