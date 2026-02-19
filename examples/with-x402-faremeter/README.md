# Example: `with-x402-faremeter`

Build a headless Solana agent that automatically pays x402-protected endpoints, using Turnkey for authentication, wallet management, and signing, plus [Faremeter](https://github.com/faremeter/faremeter) for x402 orchestration.

## Why This Example

- **Headless**: API key auth only (no browser/WebAuthn flow).
- **Turnkey-powered**: secure API auth, wallet provisioning, and Solana transaction signing.
- **Automatic**: Faremeter wraps `fetch` and handles `402` payment retries.
- **Gasless on Echo**: server pays SOL fees; your agent pays in USDC.
- **Practical**: includes balance checks, network/asset compatibility checks, and useful errors.

## Where Turnkey Is Used

| Capability          | How Turnkey is used in this example                                               |
| ------------------- | --------------------------------------------------------------------------------- |
| API authentication  | `@turnkey/sdk-server` authenticates with `API_PUBLIC_KEY` / `API_PRIVATE_KEY`     |
| Wallet lifecycle    | The example gets or creates a Solana wallet in your Turnkey organization          |
| Transaction signing | `@turnkey/solana` signs Solana payment transactions without exposing private keys |
| Security controls   | You can apply Turnkey policies to constrain what this agent can sign/spend        |

Note: In this Echo flow, transaction fees are sponsored by the x402 server's fee payer. Turnkey is the secure signer for the payer wallet.

## Quickstart

From repo root:

```bash
pnpm install -r
pnpm run build-all
cd examples/with-x402-faremeter
cp .env.local.example .env.local
```

Add values to `.env.local`:

```bash
API_PUBLIC_KEY=...
API_PRIVATE_KEY=...
ORGANIZATION_ID=...
TEST_PAYWALL_URL=https://x402.payai.network/api/solana-devnet/paid-content
```

Run:

```bash
pnpm start
```

You should see:

- `✅ Faremeter x402 client ready`
- `✅ Content received!`

## Prerequisites

- Node.js 18+
- `pnpm`
- Turnkey API key pair + organization ID
- Devnet USDC for testing (from [Circle Faucet](https://faucet.circle.com/))
- Optional devnet SOL (for non-gasless endpoints)

## Environment Variables

| Variable           | Required | Description             | Default                         |
| ------------------ | -------- | ----------------------- | ------------------------------- |
| `API_PUBLIC_KEY`   | Yes      | Turnkey API public key  | -                               |
| `API_PRIVATE_KEY`  | Yes      | Turnkey API private key | -                               |
| `ORGANIZATION_ID`  | Yes      | Turnkey organization ID | -                               |
| `TEST_PAYWALL_URL` | No       | x402 endpoint to test   | -                               |
| `SOLANA_RPC_URL`   | No       | Solana RPC endpoint     | `https://api.devnet.solana.com` |
| `BASE_URL`         | No       | Turnkey API base URL    | `https://api.turnkey.com`       |

Recommended test endpoint:

```bash
TEST_PAYWALL_URL=https://x402.payai.network/api/solana-devnet/paid-content
```

This is the [x402 Echo Server](https://x402.payai.network/), a free devnet test environment.

## Funding the Wallet

For Echo, the agent mainly needs **USDC**.

Get devnet USDC:

1. Go to [Circle Faucet](https://faucet.circle.com/)
2. Select **Solana Devnet**
3. Paste your wallet address

Optional SOL airdrop:

```bash
solana airdrop 1 <WALLET_ADDRESS> --url devnet
```

## How It Works

1. Initialize Turnkey API client + `TurnkeySigner`
2. Get or create a Solana wallet
3. Check SOL and USDC balances
4. Wrap `fetch` with Faremeter and a gasless payment handler
5. Make request:
   - if `200`: return content
   - if `402`: build/sign payment payload and retry automatically

## Example Success Output

```text
✅ Faremeter x402 client ready
📡 Fetching paywalled resource: https://x402.payai.network/api/solana-devnet/paid-content
✅ Content received!
{"success":true,"transaction":"...","network":"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1","payer":"...","premiumContent":"...","refundTransaction":"..."}
💰 Final SOL balance: ...
💵 Final USDC balance: ...
📊 SOL spent: ...
📊 USDC spent: ...
```

On Echo, USDC can be refunded quickly, so net spend may show as `0.000000`.

## Core Integration

The central integration in `src/index.ts` looks like this:

```typescript
const turnkey = new Turnkey({
  apiBaseUrl: process.env.BASE_URL || "https://api.turnkey.com",
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  defaultOrganizationId: process.env.ORGANIZATION_ID!,
});

const signer = new TurnkeySigner({
  organizationId: process.env.ORGANIZATION_ID!,
  client: turnkey.apiClient(),
});

const solanaAddress = await getOrCreateSolanaWallet(turnkey.apiClient());
const walletPubkey = new PublicKey(solanaAddress);

const turnkeyWallet = {
  publicKey: walletPubkey,
  signTransaction: async (tx: VersionedTransaction) =>
    (await signer.signTransaction(tx, solanaAddress)) as VersionedTransaction,
};

const expectedRequirementNetworks = getExpectedRequirementNetworks(network);

const gaslessHandler = createGaslessPaymentHandler(
  turnkeyWallet,
  usdcMint,
  connection,
  {
    expectedNetworks: expectedRequirementNetworks,
    configuredNetworkLabel: network,
  },
);

const normalizingFetch = createV2NormalizingFetch(fetch);
const adaptiveFetch = createAdaptivePaymentFetch(fetch);

const x402Fetch = wrapFetch(adaptiveFetch, {
  handlers: [gaslessHandler],
  phase1Fetch: normalizingFetch,
  retryCount: 3,
  returnPaymentFailure: true,
});

const response = await x402Fetch(testUrl);
```

This keeps Faremeter's `wrap()` orchestration while using Turnkey for key custody/signing and adding Echo-compatible gasless + v2 adaptation behavior.

## Troubleshooting

**`Missing required environment variables`**

- Ensure `API_PUBLIC_KEY`, `API_PRIVATE_KEY`, and `ORGANIZATION_ID` are set in `.env.local`.

**`fetch failed` / `ENOTFOUND api.turnkey.com`**

- Check internet/DNS and verify `BASE_URL`.

**`Payment failed (402)`**

- Check wallet USDC balance and network alignment (`SOLANA_RPC_URL` vs paywall endpoint).

**`No compatible Solana payment requirements found`**

- Required network/asset does not match your configured RPC network or expected mint.

**`bigint: Failed to load bindings`**

- Rebuild native binding:
  - `pnpm --filter @turnkey/example-with-x402-faremeter rebuild bigint-buffer`

## Security Considerations

When deploying agent payment flows:

1. Never commit API keys.
2. Use sub-organizations to isolate agent risk.
3. Apply [Turnkey policies](https://docs.turnkey.com/concepts/policies) for spending limits.
4. Monitor wallet and payment activity.
5. Rotate API keys regularly.

## Related Examples

- [`with-solana`](../with-solana/) - Interactive Solana signing demo

## Resources

- [Turnkey Documentation](https://docs.turnkey.com/)
- [Faremeter GitHub](https://github.com/faremeter/faremeter)
- [Faremeter Documentation](https://docs.corbits.dev/faremeter/overview)
- [x402 Protocol](https://github.com/coinbase/x402)
- [x402 Echo Server](https://x402.payai.network/)
- [Circle Faucet](https://faucet.circle.com/)
- [Solana Faucet](https://faucet.solana.com/)
