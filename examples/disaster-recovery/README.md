# Disaster Recovery with Turnkey

This example provides runnable code for implementing wallet disaster recovery using Turnkey's secure infrastructure. It covers two primary solution paths:

1. **Path 1: Direct Wallet Import (Recommended)** - Import existing wallet private keys directly into Turnkey's secure enclaves for immediate operational capability
2. **Path 2: Encryption Key Escrow** - Use Turnkey to store encryption keys that protect externally-stored recovery bundles

## Prerequisites

- Node.js v18+
- A Turnkey organization with API credentials
- For Path 1 sweep operations: An Ethereum wallet with funds (use Sepolia testnet for testing)

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.local.example .env.local

# Edit .env.local with your Turnkey credentials

# Launch the interactive CLI
pnpm start
```

The interactive CLI provides a menu-driven interface for all disaster recovery operations:
- Generate test wallets for testing/PoC
- Path 1: Import wallets and sweep funds
- Path 2: Set up and recover from encryption escrow

You can also run individual scripts directly (see below).

## Environment Variables

```bash
# Required for all operations
API_PUBLIC_KEY="<Turnkey API public key>"
API_PRIVATE_KEY="<Turnkey API private key>"
BASE_URL="https://api.turnkey.com"
ORGANIZATION_ID="<Your Turnkey organization ID>"

# Required for import operations (Path 1)
USER_ID="<Turnkey user ID>"

# Required for fund sweeping (Path 1)
SIGN_WITH="<Ethereum address of imported wallet>"
SAFE_TREASURY_ADDRESS="<Safe destination address>"

# Optional: Alchemy API key for RPC
ALCHEMY_API_KEY="<Your Alchemy API key>"

# Required for Path 2
ENCRYPTION_KEY_ID="<Private key ID from Turnkey>"
```

---

## Testing with Generated Wallets

For testing/PoC purposes, you can generate a test wallet locally:

```bash
pnpm run generate-test-wallet
```

This will:
1. Generate a random 12 or 24 word mnemonic, OR a raw private key
2. Show the derived Ethereum address
3. Optionally save to a JSON file for reference

**Testing flow:**
1. Generate a test wallet
2. Fund it with Sepolia testnet ETH from a faucet:
   - https://sepoliafaucet.com
   - https://www.alchemy.com/faucets/ethereum-sepolia
3. Import the wallet into Turnkey using `pnpm run path1:import-wallet`
4. Test sweeping funds with `pnpm run path1:sweep-funds`

---

## Path 1: Direct Wallet Import (Recommended)

**Best for:** Fast recovery, automated fund sweeping, and centralized policy controls.

### Why This Approach

| Benefit | Description |
|---------|-------------|
| Immediate Recovery | Keys are operational within Turnkey instantly—no decryption ceremonies |
| Asset Agnostic | Single path for Bitcoin, Ethereum, Solana, and any SECP256k1/Ed25519 chains |
| Fund Sweeping | SDK enables rapid fund movement without custom tooling |
| Policy Controls | Full access to quorum policies, whitelisting, and transaction limits |

### Import HD Wallet (Mnemonic)

Import a BIP-39 mnemonic seed phrase into Turnkey:

```bash
pnpm run path1:import-wallet
```

This will:
1. Initialize an import bundle (temporary encryption key from Turnkey's enclave)
2. Prompt for your mnemonic seed phrase
3. Encrypt the mnemonic to Turnkey's ephemeral public key
4. Import the encrypted wallet into Turnkey

### Import Raw Private Key

Import a raw private key (Ethereum, Solana, or Bitcoin):

```bash
pnpm run path1:import-key
```

Supports:
- Ethereum/EVM (SECP256K1)
- Solana (ED25519)
- Bitcoin (SECP256K1)

### Sweep Funds

After importing a wallet, sweep ETH to a safe treasury address:

```bash
# Set the imported wallet address and destination
export SIGN_WITH="0x..."  # Address of imported wallet
export SAFE_TREASURY_ADDRESS="0x..."  # Your safe destination

pnpm run path1:sweep-funds
```

Features:
- Network selection (Sepolia testnet or Mainnet)
- Gas estimation and balance checking
- Confirmation prompts for safety
- Transaction status tracking

### Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OFFLINE CEREMONY                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Export Key  │───▶│  Encrypt to  │───▶│  Transport   │       │
│  │  from Current│    │  Turnkey TEK │    │  Encrypted   │       │
│  │  Provider    │    │              │    │  Bundle      │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 TURNKEY SECURE ENCLAVE                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  HPKE Decryption  ───▶  Key Storage  ───▶  Policy Engine │   │
│  │                        (Encrypted to      (Quorum, White-│   │
│  │                         Quorum Key)        lists, Limits) │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Key material NEVER exists in plaintext outside the enclave     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Path 2: Encryption Key Escrow

**Best for:** Keeping wallet material outside Turnkey while using Turnkey for authenticated access to encryption keys.

### When to Use This Approach

- Wallet recovery for non-custodial products kept separate from Turnkey
- Backing up non-wallet material (API keys, secrets, credentials)
- Compliance requires key material separation from infrastructure provider

### Setup: Create Encryption Key and Encrypt Bundle

```bash
pnpm run path2:setup
```

This will:
1. Create a P-256 encryption keypair in Turnkey (for encryption only, not on-chain)
2. Prompt for your recovery material (mnemonic, credentials, or custom data)
3. Encrypt the bundle with Turnkey's public key
4. Save the encrypted bundle locally (you move this to your secure storage)

**Important:** The encrypted bundle should be stored in YOUR infrastructure, not on Turnkey. This creates a 2-of-2 security model.

### Recovery: Export Key and Decrypt Bundle

```bash
# Set the encryption key ID (from setup step)
export ENCRYPTION_KEY_ID="pk-..."

pnpm run path2:recovery
```

This will:
1. Generate a target keypair for receiving the exported key
2. Export the encryption private key from Turnkey (may require quorum approval)
3. Decrypt the export bundle to get the raw private key
4. Load and decrypt your stored recovery bundle

### Security Properties

| Scenario | Impact |
|----------|--------|
| Customer infrastructure breach | Attacker gets encrypted blobs but cannot decrypt without Turnkey authentication |
| Turnkey user breach | Attacker could access the encryption keypair but doesn't have the encrypted bundles |
| Both breached | Both parties must be compromised simultaneously for full recovery |

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER'S DEVICE                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │ Public      │───▶│   Encrypt   │───▶│  Encrypted Bundle   │  │
│  │ Key (local) │    │   Material  │    │  (to your storage)  │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│        ▲                                                         │
│        │ Public Key shared                                       │
└────────┼────────────────────────────────────────────────────────┘
         │
┌────────┼────────────────────────────────────────────────────────┐
│        │              TURNKEY SECURE ENCLAVE                     │
│  ┌─────┴───────────────────────────────────────────────────┐    │
│  │  Encryption Keypair  ◀── Authentication Layer           │    │
│  │  (P-256)             (email, passkey, API key, etc.)    │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Encrypted bundle stored externally
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              YOUR INFRASTRUCTURE                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Encrypted Recovery Bundle Storage                        │   │
│  │  (Your servers, AWS S3, third-party vault, etc.)         │   │
│  │                                                           │   │
│  │  • Turnkey never sees this data                          │   │
│  │  • You control storage location and policies             │   │
│  │  • Bundle is useless without Turnkey authentication      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Comparison: Path 1 vs Path 2

| Factor | Path 1: Direct Import | Path 2: Encryption Escrow |
|--------|----------------------|---------------------------|
| Recovery Speed | Immediate—keys operational in Turnkey | Requires decryption ceremony |
| Fund Sweeping | Built-in SDK support | Requires wallet tooling after decryption |
| Key Storage | Turnkey holds wallet keys in enclave | Turnkey holds only encryption keys |
| Material Location | Turnkey secure enclave | Your storage (encrypted) |
| Complexity | Lower | Higher |
| Best For | Enterprise DR, treasury backup | User recovery, compliance separation |
| Security Model | Single party (authorized Turnkey users) | 2-of-2 (Turnkey auth + bundle access) |

---

## Security Best Practices

### For Production Use

1. **Air-gapped encryption**: Perform wallet import encryption on an offline machine
2. **Hardware authenticators**: Use YubiKeys or passkeys for root quorum users
3. **Quorum policies**: Configure M-of-N approval for key export operations
4. **Geographic distribution**: Store backup authenticators in separate secure locations
5. **Audit logging**: Document all DR operations with signed audit logs

### Example Quorum Policy for DR Sweeping

```json
{
  "policyName": "DR-Sweep-Only-Policy",
  "effect": "EFFECT_ALLOW",
  "condition": "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2' && eth.tx.to in ['0xSAFE_TREASURY_1', '0xSAFE_TREASURY_2']",
  "consensus": "approvers.any(user, user.id == 'DR_AUTOMATION_USER_ID')"
}
```

This allows automated sweeping ONLY to pre-approved addresses.

---

## File Structure

```
disaster-recovery/
├── README.md
├── package.json
├── tsconfig.json
├── .env.local.example
└── src/
    ├── shared/
    │   ├── turnkey.ts          # Turnkey client initialization
    │   └── crypto-helpers.ts   # Encryption/decryption utilities
    ├── path1-direct-import/
    │   ├── import-wallet.ts    # Import HD wallet (mnemonic)
    │   ├── import-private-key.ts # Import raw private key
    │   └── sweep-funds.ts      # Sweep ETH to safe address
    └── path2-encryption-escrow/
        ├── setup.ts            # Create encryption key & encrypt bundle
        └── recovery.ts         # Export key & decrypt bundle
```

---

## Troubleshooting

### "Missing required environment variable"
Ensure all required variables are set in `.env.local`. Copy from `.env.local.example` and fill in your values.

### "Quorum approval required"
Your Turnkey organization has policies requiring multiple approvers. Coordinate with other key holders.

### "Not enough ETH to sweep"
The wallet balance is too low to cover gas costs. Fund the wallet or use a different network.

### Import fails with encryption error
Ensure you're using a valid BIP-39 mnemonic (12 or 24 words) or correctly formatted private key.

---

## Resources

- [Turnkey Documentation](https://docs.turnkey.com)
- [Turnkey SDK Server](https://www.npmjs.com/package/@turnkey/sdk-server)
- [Turnkey Crypto](https://www.npmjs.com/package/@turnkey/crypto)
- [Turnkey CLI](https://github.com/tkhq/tkcli)
