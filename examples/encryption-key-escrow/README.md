# Encryption Key Escrow

This example demonstrates how to use Turnkey as a **secure key storage and retrieval service** rather than relying on Turnkey for signing operations directly. By leveraging Turnkey's secure enclaves to hold encryption keys while keeping encrypted data in your own infrastructure, you can build applications that:

- Maintain full control over signing and cryptographic operations
- Achieve performance characteristics not possible with network-based signing
- Implement user-controlled backup and recovery flows
- Distribute trust between Turnkey and your infrastructure

## The Pattern: Key Separation

The encryption key escrow pattern separates two components:

| Component | Location | Purpose |
|-----------|----------|---------|
| **Encrypted data** | Your infrastructure | Wallet bundles, recovery material, sensitive credentials |
| **Encryption key** | Turnkey secure enclave | Decryption only possible via authenticated Turnkey access |

This creates a **2-of-2 security model**: an attacker must compromise both your infrastructure AND Turnkey authentication to access the plaintext data.

```
┌──────────────────────────────────┐     ┌──────────────────────────────────┐
│     YOUR INFRASTRUCTURE          │     │     TURNKEY SECURE ENCLAVE       │
│                                  │     │                                  │
│  ┌────────────────────────────┐  │     │  ┌────────────────────────────┐  │
│  │   Encrypted Bundles  ✓    │  │     │  │   Encryption Key  ✓        │  │
│  │   Encryption Key     ✗    │  │     │  │   Encrypted Bundles  ✗     │  │
│  └────────────────────────────┘  │     │  └────────────────────────────┘  │
│                                  │     │                                  │
│  You control storage, access,    │     │  Protected by authentication,    │
│  and data lifecycle              │     │  policies, and quorum controls   │
└──────────────────────────────────┘     └──────────────────────────────────┘
                    │                                     │
                    └─────────────┬───────────────────────┘
                                  │
                                  ▼
                     Both required to decrypt
```

## Use Cases

### 1. High-Performance Multi-Wallet Signing

Applications requiring ultra-fast signing (trading platforms, gaming, batch operations) can:

- Store encrypted wallet bundles in client-side storage (localStorage, IndexedDB)
- Export the decryption key once per session (~100ms, single API call)
- Decrypt all wallets locally and sign with zero network latency
- Scale to hundreds of wallets without performance degradation

**Performance:** Session initialization is O(1) for key export regardless of wallet count.

### 2. User-Controlled Backup & Recovery

Similar to [World App's integration with Turnkey](https://www.turnkey.com/blog/turnkey-announces-integration-tools-for-humanitys-world-app), applications can:

- Encrypt user recovery bundles on-device
- Store the encryption key in Turnkey, gated by user authentication (OAuth, passkeys)
- Keep encrypted bundles client-side or in your storage
- Enable recovery by authenticating to Turnkey to retrieve the decryption key

**Benefit:** Users maintain control of their encrypted data while Turnkey provides secure, authenticated access to decryption capability.

### 3. Distributed Trust Models

For compliance or architectural requirements where key material must be separated:

- Store sensitive credentials encrypted in your infrastructure
- Gate decryption through Turnkey's authentication and policy engine
- Require quorum approval for key export in high-security scenarios
- Maintain audit trails of all key access events

## How It Works

### Initial Setup

1. **Create encryption keypair** in Turnkey (P-256, stored in secure enclave)
2. **Encrypt sensitive material** using the public key
3. **Store encrypted bundles** in your infrastructure (Turnkey never sees this data)

### Per-Session / On-Demand Access

1. **User authenticates** to your application
2. **Export decryption key** from Turnkey (single API call, ~100ms)
3. **Decrypt data locally** in your application
4. **Use decrypted material** for signing, recovery, or other operations
5. **Clear sensitive data** from memory when done

### Security Properties

| Scenario | Impact |
|----------|--------|
| Your storage compromised | Attacker gets encrypted blobs, cannot decrypt without Turnkey auth |
| Turnkey credentials compromised | Attacker can export key but has no encrypted bundles |
| Both compromised | Full access (inherent to any 2-of-2 model) |

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

## Interactive CLI Menu

The CLI provides a complete walkthrough of the escrow pattern:

### Initial Setup
1. **Create Encryption Key** - Generate a P-256 keypair in Turnkey
2. **Generate & Encrypt Wallets** - Create test wallets and encrypt them

### Per-Session Flow
3. **Start Session** - Export decryption key and decrypt wallet bundles
4. **Sign Message (Demo)** - Sign with any decrypted wallet (local, instant)
5. **End Session** - Burn decryption key and clear memory

### Utilities
- **View Encrypted Store** - Inspect the encrypted wallet bundles

## Environment Variables

```bash
# Required - Turnkey API credentials
API_PUBLIC_KEY="<Your Turnkey API public key>"
API_PRIVATE_KEY="<Your Turnkey API private key>"
BASE_URL="https://api.turnkey.com"
ORGANIZATION_ID="<Your Turnkey organization ID>"

# Created during setup
ENCRYPTION_KEY_ID="<Private key ID from Turnkey>"
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR APPLICATION                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              ENCRYPTED DATA STORE                        │    │
│  │  (localStorage, IndexedDB, S3, database, etc.)          │    │
│  │                                                          │    │
│  │  • Wallet bundles, recovery material, credentials        │    │
│  │  • Encrypted with P-256 ECIES                           │    │
│  │  • Turnkey never sees this data                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              │ On-demand decryption              │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              ACTIVE SESSION (in memory)                  │    │
│  │                                                          │    │
│  │  • Decrypted material available for use                 │    │
│  │  • Local signing, recovery operations, etc.             │    │
│  │  • Cleared when session ends                            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Authenticated key export
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│                 TURNKEY SECURE ENCLAVE                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Encryption Keypair (P-256)                               │   │
│  │                                                           │   │
│  │  • Public key: shared for encryption                      │   │
│  │  • Private key: exported only via authenticated requests  │   │
│  │  • Protected by policies and optional quorum approval     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Turnkey provides:                                               │
│  • Secure key storage in TEE-based enclaves                     │
│  • Authentication (API keys, passkeys, OAuth)                   │
│  • Policy engine for access control                             │
│  • Audit logging of all key operations                          │
└─────────────────────────────────────────────────────────────────┘
```

## Production Considerations

### Quorum Policies

For sensitive keys, require multi-party approval for export:

```json
{
  "policyName": "Escrow-Key-Export-Policy",
  "effect": "EFFECT_ALLOW",
  "condition": "activity.type == 'ACTIVITY_TYPE_EXPORT_PRIVATE_KEY'",
  "consensus": "approvers.count() >= 2"
}
```

### Authentication Options

Turnkey supports multiple authentication methods for key export:
- **API keys** - For server-to-server access
- **Passkeys** - For user-initiated access (WebAuthn)
- **OAuth** - For social login flows
- **Email/SMS OTP** - For additional verification

### Storage Options

Encrypted bundles can be stored anywhere you control:
- **Client-side:** localStorage, IndexedDB, secure enclaves (mobile)
- **Server-side:** Your database, S3, GCS, or any object storage
- **Hybrid:** Replicated across client and server for redundancy

## File Structure

```
encryption-key-escrow/
├── README.md
├── package.json
├── tsconfig.json
├── .env.local.example
└── src/
    ├── interactive.ts       # Main CLI application
    └── shared/
        ├── turnkey.ts       # Turnkey client initialization
        └── crypto-helpers.ts # ECIES encryption utilities
```

## Related Resources

- [World App Backup Service](https://github.com/worldcoin/backup-service) - Production implementation of encryption key escrow
- [Turnkey + World App Blog Post](https://www.turnkey.com/blog/turnkey-announces-integration-tools-for-humanitys-world-app) - Case study on user-controlled recovery
- [Turnkey Secure Enclaves](https://docs.turnkey.com/security/secure-enclaves) - How Turnkey protects key material
- [Export Private Keys](https://docs.turnkey.com/wallets/export-wallets) - API documentation for key export
- [Policy Engine](https://docs.turnkey.com/concepts/policies/quickstart) - Configuring access controls
