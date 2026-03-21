# Agent Auth Examples

Examples demonstrating `@turnkey/agent-auth` for provisioning isolated, policy-gated cryptographic identities for AI agents.

## Setup

1. Copy the environment template:

   ```bash
   cp .env.local.example .env.local
   ```

2. Fill in your Turnkey credentials in `.env.local`:
   - `API_PUBLIC_KEY` and `API_PRIVATE_KEY`: Your parent org API key
   - `ORGANIZATION_ID`: Your Turnkey organization ID
   - `BASE_URL`: Turnkey API URL (default: `https://api.turnkey.com`)

3. Install dependencies:
   ```bash
   pnpm install
   ```

## Examples

### Full Lifecycle (`pnpm start`)

Complete walkthrough of the agent auth flow:

- Provisions an agent with JWT signing (P256) and git signing (Ed25519) accounts
- Adds a custom policy (sign_transaction) beyond the default (sign_raw_payload)
- Signs payloads with both account types
- Verifies policy enforcement (createUsers blocked by implicit deny)
- Exports the Ed25519 key via HPKE (for sandbox injection)
- Tears down the session

### Minimal (`pnpm run minimal`)

Simplest possible usage. Creates an agent session with no wallet accounts and the default signing policy, then cleans up. Good starting point for understanding the API.

### Signing Helpers (`pnpm run signing`)

Demonstrates all three signing helpers:

- `signJwt`: Mint ES256 JWTs for API authentication (MCP servers, internal APIs)
- `signSshCommit`: Sign git commits with Ed25519 in SSHSIG format (for "Verified" badges)
- `signMessage`: General-purpose signing returning raw r, s, v components

Shows JWT decoding, SSHSIG armored output, and the complete signing flow without ever exposing private keys.

### Policy Templates (`pnpm run policies`)

Demonstrates composable policy templates for fine-grained access control:

- `allowAllSigning()`: Replace default with broader signing permissions
- `allowEthTransaction()`: Restrict by chain, max value, allowed addresses
- `allowErc20Transfer()`: Token-specific transfer policies
- `allowEip712Signing()`: Domain-specific typed data signing

Shows how templates compose to build a complete permission profile.

### Multi-Agent Swarm (`pnpm run multi-agent`)

Provisions three agents with different capabilities (JWT, git, ETH signing) from the same parent org. Demonstrates:

- Batch provisioning
- Per-agent account configuration via presets
- Cross-agent isolation (Agent 1 cannot access Agent 2's sub-org)
- Batch cleanup with error handling
