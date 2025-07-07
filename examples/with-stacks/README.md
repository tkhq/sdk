# Example: `with-stacks`

A sample script that is showing how to sign a [Stacks](https://docs.hiro.so/stacks/stacks.js) transaction with Turnkey.
Stacks uses the secp256k1 curve for transaction signing but there is some specific data formatting we that takes place for the [signing process](https://github.com/stacksgov/sips/blob/main/sips/sip-005/sip-005-blocks-and-transactions.md#transaction-signing-and-verifying).

Simplified step-by-step process of what this example script is showing:

1. Generate sigHash from unsigned transaction
2. Generate preSignSigHash
3. ECDSA sign preSignSigHash with a Turnkey private key
4. Concatenate outputted raw signature (from step 3) components in the order of V + R + S
5. The resulting signature of step 4 will be the nextSig
6. Reassign spendingCondition.signature with nextSig
7. Generate postSignSigHash by combining the preSignSigHash, public key encoding byte, and nextSig
8. The result of step 7 will be called the nextSigHash
9. Reassign the current signer.sigHash with the nextSigHash

**Note:** The hashFunction `HASH_FUNCTION_NO_OP` should be set this way because the payload has already been hashed.

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable  # Install `pnpm`
$ pnpm install -r  # Install dependencies
$ pnpm run build-all  # Compile source code
$ cd examples/with-stacks/
```

### 2/ Setting up Turnkey

The first step is to set up your Turnkey organization and account. By following the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) guide, you should have:

- A public/private API key pair for Turnkey parent organization
- A public/private API key pair for the Delegated account
- An organization ID

Once you've gathered these values, add them to a new `.env.local` file. Notice that your private key should be securely managed and **_never_** be committed to git.

```bash
cp .env.local.example .env.local
```

Now open `.env.local` and add the missing environment variables:

- `TURNKEY_API_PUBLIC_KEY`
- `TURNKEY_API_PRIVATE_KEY`
- `TURNKEY_BASE_URL`
- `TURNKEY_ORGANIZATION_ID`
- `TURNKEY_SIGNER_PUBLIC_KEY`
- `STACKS_RECIPIENT_ADDRESS`

Make sure to use either a `SECP256K1` compressed or uncompressed wallet account / private key for Stacks.

### 2/ Running the script

```bash
pnpm start
```
