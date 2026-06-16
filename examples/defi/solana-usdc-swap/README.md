# Example: `solana-usdc-swap`

This example swaps SOL to USDC on Solana mainnet with Turnkey signing and optional Turnkey gas sponsorship.

The point of the example is rent safety. Jupiter's default SOL swap flow can create a temporary WSOL token account and close it at the end of the transaction. In a sponsored transaction, that can mean the sponsor pays rent and the signer receives the rent refund.

## Getting started

```bash
git clone https://github.com/tkhq/sdk
cd sdk/
corepack enable
pnpm install -r
pnpm run build-all
cd examples/defi/solana-usdc-swap/
cp .env.local.example .env.local
```

Fill in:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `ORGANIZATION_ID`
- `SIGN_WITH` - the Solana address of the wallet to swap from
- `JUPITER_API_KEY`

## Run it

```bash
pnpm start
```

The script has three useful paths:

1. **Basic unsponsored swap**
   Choose `Use Turnkey gas sponsorship? no`.
   This uses Jupiter's default swap transaction. It is the simple baseline; there is no sponsor rent leakage because sponsorship is off.

2. **Recommended sponsored path**
   Choose `Use Turnkey gas sponsorship? yes`, then `Use pre-created token accounts`.
   The script checks the signer's WSOL and USDC token accounts. If they are missing, or if WSOL is too low, it asks to prepare them with sponsorship first. That preparation can subsidize rent, but it does not include close-account cleanup, so it does not automatically refund rent to the signer.

   After preparation, the swap asks Jupiter for instructions with:

   ```ts
   wrapAndUnwrapSol: false;
   destinationTokenAccount: usdcAta;
   ```

   The script then rejects the route if Jupiter still returns setup or cleanup instructions.

3. **Advanced mitigation path**
   Choose `Use Turnkey gas sponsorship? yes`, then `Advanced: strip cleanup, rent remains locked`.
   This path requests Jupiter swap instructions, detects a signer-refunding SPL Token `CloseAccount`, and strips that cleanup instruction before sending.

   This prevents the same-transaction rent refund, but it can leave sponsor-funded rent locked in a signer-controlled account. The pre-created-account path is the better default.

## Unsafe sponsored shape

This is the tempting shape to avoid:

```ts
body: JSON.stringify({
  quoteResponse,
  userPublicKey: signWith,
  wrapAndUnwrapSol: true,
  dynamicComputeUnitLimit: true,
  prioritizationFeeLamports: "auto",
});

await turnkey.apiClient().solSendTransaction({
  organizationId,
  unsignedTransaction,
  signWith,
  caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  sponsor: true,
});
```

That can create and close a temporary account in the same sponsored transaction, refunding rent to the signer.

## Test amounts

The default swap amount is `0.00005 SOL`, intentionally tiny for mainnet testing.

References:

- [Jupiter Swap API](https://developers.jup.ag/docs/api-reference/swap/v1/swap)
- [Jupiter Swap Instructions API](https://developers.jup.ag/docs/api-reference/swap/v1/swap-instructions)
- [Jupiter gasless swaps](https://developers.jup.ag/docs/swap/advanced/gasless)
