# @turnkey/viem

[![npm](https://img.shields.io/npm/v/@turnkey/viem?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/viem)

This package contains helpers to use [Viem](https://viem.sh/) with [Turnkey](https://turnkey.com).

We provide a Turnkey [Custom Account](https://viem.sh/docs/accounts/custom.html#custom-account) (signer) which implements the signing APIs expected by Viem clients.

If you need a lower-level, fully typed HTTP client for interacting with Turnkey API, check out [`@turnkey/http`](https://www.npmjs.com/package/@turnkey/http).

## Getting started

```bash
$ npm install viem @turnkey/viem
```

```typescript
import { createAccount } from "@turnkey/viem";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";

async function main() {
  // Create a Turnkey HTTP client with API key credentials
  const httpClient = new TurnkeyClient(
    {
      baseUrl: "https://api.turnkey.com",
    },
    // This uses API key credentials.
    // If you're using passkeys, use `@turnkey/webauthn-stamper` to collect webauthn signatures:
    // new WebauthnStamper({...options...})
    new ApiKeyStamper({
      apiPublicKey: "...",
      apiPrivateKey: "...",
    }),
  );

  // Create the Viem custom account
  const turnkeyAccount = await createAccount({
    client: httpClient,
    organizationId: "...",
    signWith: "...",
    // optional; will be fetched from Turnkey if not provided
    ethereumAddress: "...",
  });

  // Below: standard Viem APIs are used, nothing special!

  const client = createWalletClient({
    account: turnkeyAccount,
    chain: sepolia,
    transport: http(`https://sepolia.infura.io/v3/$(YOUR_INFURA_API_KEY)`),
  });

  const transactionRequest = {
    to: "0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7" as `0x${string}`,
    value: 1000000000000000n, // 0.001 ETH
  };

  const txHash = await client.sendTransaction(transactionRequest);
  console.log(`Success! Transaction broadcast with hash ${txHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

## Testing (Local)

1. Copy `.env.example` to `.env`

   ```bash
   $ cp .env.example .env
   ```

2. Start the Anvil node in one shell:

   - Install [Foundry](https://book.getfoundry.sh/getting-started/installation) & Anvil if you haven't done so already
   - Add Foundry to your `$PATH`
     ```bash
     $ export PATH="$PATH:$HOME/.foundry/bin"
     ```
   - Source your env e.g.
     ```bash
     $ source ~/.zshrc
     ```
   - Run `foundryup` to install `Anvil`
     ```bash
     $ foundryup
     ```
   - Start Anvil
     ```
     $ pnpm anvil
     ```

3. Run the tests in a new shell:

   ```
   $ pnpm test
   ```

## See also

- [`@turnkey/example-with-viem`](https://github.com/tkhq/sdk/tree/main/examples/with-viem): example using this package to create, sign, and broadcast a transaction on Sepolia (Ethereum testnet)
- [`@turnkey/http`](https://www.npmjs.com/package/@turnkey/http): lower-level fully typed HTTP client for interacting with Turnkey API
- [`@turnkey/api-key-stamper`](https://www.npmjs.com/package/@turnkey/api-key-stamper): package to authenticate to Turnkey using API key credentials
- [`@turnkey/webauthn-stamper`](https://www.npmjs.com/package/@turnkey/webauthn-stamper): package to authenticate to Turnkey using Webauthn/passkeys.

## Transaction types supported

- Turnkey's Viem implementation now supports all transaction types: legacy, EIP-2930 (Type 1), EIP-1559 (Type 2), EIP-4844 (Type 3), and EIP-7702 (Type 4). See [with-viem](https://github.com/tkhq/sdk/tree/main/examples/with-viem/) for examples of scripts that sign using those various types.
