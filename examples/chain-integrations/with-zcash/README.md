# Example: `with-zcash`

This example sends transparent Zcash with:

- Turnkey `signRawPayload` for secp256k1 ECDSA signatures.
- A local transparent-only Zcash transaction builder for v5 / NU5+ transactions.
- A zcashd-compatible JSON-RPC endpoint for UTXO lookup and `sendrawtransaction`.

Turnkey-native broadcast is intentionally out of scope here. The final signed transaction is submitted to the RPC endpoint you configure in `.env.local`.

## Scope

This is deliberately a Tier 1 style integration:

- Supports transparent P2PKH sender addresses derived from `ADDRESS_FORMAT_COMPRESSED` accounts.
- Supports transparent P2PKH and P2SH recipient/change addresses.
- Uses ZIP-244 `SIGHASH_ALL`.
- Does not support shielded Sapling/Orchard spends, unified addresses, transparent multisig/P2SH inputs, coinbase inputs, or Turnkey `SignTransaction`.

## Getting started

From the repo root:

```bash
corepack enable
pnpm install -r
pnpm run build-all
cd examples/chain-integrations/with-zcash
cp .env.local.example .env.local
```

Fill in `.env.local`:

- `API_PUBLIC_KEY`, `API_PRIVATE_KEY`, `BASE_URL`, `ORGANIZATION_ID`
- `SIGN_WITH`: an `ADDRESS_FORMAT_COMPRESSED` Turnkey wallet account address, or a private key ID
- `SIGNER_COMPRESSED_PUBLIC_KEY`: required when `SIGN_WITH` is not itself the compressed public key
- `ZCASH_RPC_URL`: zcashd-compatible JSON-RPC endpoint
- `DESTINATION_TADDRESS`
- `SEND_AMOUNT_ZATOSHIS`
- `FEE_ZATOSHIS`

If your RPC endpoint does not support `getaddressutxos`, set `UTXOS_JSON` manually. Each UTXO needs:

```json
[
  {
    "txid": "previous transaction id",
    "vout": 0,
    "valueZatoshis": 1000000,
    "scriptPubKey": "optional previous output script hex"
  }
]
```

Run without broadcasting first:

```bash
pnpm start
```

Set `BROADCAST=true` to submit through your configured Zcash RPC:

```bash
BROADCAST=true pnpm start
```

## Flow

1. Derive the sender transparent P2PKH address from the compressed public key.
2. Fetch or load UTXOs.
3. Build a transparent v5 transaction with recipient and change outputs.
4. Compute ZIP-244 per-input signature digests.
5. Ask Turnkey to sign each digest with `HASH_FUNCTION_NO_OP`.
6. Insert DER signatures into each P2PKH `scriptSig`.
7. Serialize and optionally broadcast with `sendrawtransaction`.

References:

- Zcash protocol specification, sections 5.6.1.1 and 7.1
- ZIP-244 transaction and signature digest algorithm
