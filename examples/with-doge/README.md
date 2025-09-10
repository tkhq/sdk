# Example: `with-doge`

This script shows how to send Dogecoin on testnet using:

- [bitcoinjs-lib](https://github.com/bitcoinjs/bitcoinjs-lib) for transaction building.
- Turnkey for signing raw payload digests (secp256k1).
- [Electrs Testnet API](https://doge-electrs-testnet-demo.qed.me/) for UTXO lookup & broadcasting.

**1.Network Parameters**

We override Bitcoin defaults to use Dogecoin testnet parameters:

```
const dogeTestnet: bitcoin.networks.Network = {
  messagePrefix: "\x19Dogecoin Signed Message:\n",    // Prefix for message signing
  bech32: undefined as any,                           // Dogecoin has no bech32 segwit
  bip32: { public: 0x043587cf, private: 0x04358394 }, // Testnet HD wallets
  pubKeyHash: 0x71,                                   // P2PKH addresses → “n” / “m”
  scriptHash: 0xc4,                                   // P2SH addresses → “2” (not used here)
  wif: 0xf1,                                          // WIF private key prefix (testnet)
};
```

References:

- Dogecoin Core [chainparams.cpp](https://github.com/dogecoin/dogecoin/blob/master/src/chainparams.cpp)
- bitcoinjs-lib [networks](https://github.com/bitcoinjs/bitcoinjs-lib#networks)

**2.Fetch UTXOs**

Ask Electrs for unspent outputs at the sender address:

```
async function getUtxos(addr: string) { ... }
```

- Calls GET /address/:address/utxo
- Normalizes results to { txid, vout, valueSats }

References:

- Electrs API: [addresses](https://github.com/Blockstream/esplora/blob/master/API.md#addresses)

**3.Coin Selection**

```
function selectUtxos(utxos: UTXO[], need: number) { ... }
```

- Sorts UTXOs from largest → smallest
- Picks until total ≥ (send amount + fee)
- Returns { picked, total }
- Simple “greedy” strategy; good enough for test/demo, but real wallets use smarter policies for privacy/dust.

**4.Signatures with Turnkey**

```
async function turnkeySignDigestHex(digestHex: string): Promise<string> { ... }
```

- Bitcoin-style txs use a sighash digest (32 bytes) per input
- We send that digest to Turnkey via signRawPayload
- Turnkey returns { r, s }
- We normalize s into the “low-S” range (required by Bitcoin/Dogecoin standardness rules)
- Convert (r, s) into a DER signature for scriptSig

References:

- [Low-S signatures](https://github.com/bitcoin/bitcoin/pull/6769)
- [BIP66: Strict DER signatures](https://github.com/bitcoin/bips/blob/master/bip-0066.mediawiki)

**5.Build the Transaction**

```
const tx = new bitcoin.Transaction();
tx.version = 1;

// Inputs: UTXOs we’re spending
for (const u of UTXOS) {
  tx.addInput(Buffer.from(u.txid, 'hex').reverse(), u.vout, 0xffffffff);
}

// Outputs: recipient + change
tx.addOutput(toOutputScript(DEST_ADDRESS), SEND_AMOUNT_SATS);
if (change > 0) {
  tx.addOutput(toOutputScript(SIGN_WITH), change);
}
```

`tx.addInput`:

- Reverses txid (little-endian in raw txs)
- Uses vout to point to the correct output
- Marks sequence 0xffffffff (final)

`tx.addOutput`:

- Builds P2PKH script for recipient
- Adds change back to sender if needed

Fee = sum(inputs) − sum(outputs)

**6.Sign Inputs**

```
for (let i = 0; i < UTXOS.length; i++) {
  const digest = tx.hashForSignature(i, prevScript, hashType);
  const derHex = await turnkeySignDigestHex(digestHex);
  const sigWithType = Buffer.concat([Buffer.from(derHex, "hex"), Buffer.from([hashType & 0xff])]);
  tx.setInputScript(i, bitcoin.script.compile([sigWithType, pubkey]));
}
```

- Compute sighash digest for each input
- Ask Turnkey to sign → DER sig
- Append 0x01 (SIGHASH_ALL flag)
- Build scriptSig = [sig, pubkey]

**7.Broadcast & Confirm**

- POST hex to Electrs /tx
- Poll /tx/:txid/status until confirmed=true

To recap the full flow: 1. Fetch UTXOs (unspent coins) 2. Select enough inputs to cover send+fee 3. Build transaction (inputs, outputs, change) 4. Compute sighashes & sign with Turnkey 5. Insert signatures & pubkeys into inputs 6. Serialize (toHex) and broadcast via Electrs 7. Poll for confirmation

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v20+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable     # Install `pnpm`
$ pnpm install -r     # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-doge/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey
- An organization ID
- A Turnkey wallet

Create a Turnkey new wallet account on Dogecoin testnet and use a [faucet](https://faucet.triangleplatform.com/dogecoin/testnet) to get some test DOGE.

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
$ cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `SIGNER_ADDRESS`: Turnkey wallet Doge address (testnet)
- `SIGNER_ADDRESS_PUBKEY`: Turnkey wallet address public key
- `DEST_ADDRESS`: Doge testnet destination address (for simplicity you can send it to yourself)

### 3/ Running the scripts

```bash
$ pnpm start
```
