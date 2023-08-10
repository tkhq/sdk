# @turnkey/viem

[![npm](https://img.shields.io/npm/v/@turnkey/viem?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/viem)

This package contains helpers to work with [Turnkey](https://turnkey.com). Currently:
* a Turnkey [Custom Account](https://viem.sh/docs/accounts/custom.html#custom-account) (signer)

If you need a lower-level, fully typed HTTP client for interacting with Turnkey API, check out [`@turnkey/http`](https://www.npmjs.com/package/@turnkey/http).

## Getting started

```bash
$ npm install viem @turnkey/viem
```

```typescript
import { createWalletClient, http } from "viem";
import { createAccount } from "@turnkey/viem";

async function main() {
  const turnkeyAccount = createAccount({
    organizationId: "...",
    privateKeyId: "...",
    apiPublicKey: "...",
    apiPrivateKey: "...",
    baseUrl: "https://api.turnkey.com",
  });

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

## See also

- [`@turnkey/example-with-viem`](https://github.com/tkhq/sdk/tree/main/examples/with-viem): example using this package to create, sign, and broadcast a transaction on Sepolia (Ethereum testnet)
- [`@turnkey/http`](https://www.npmjs.com/package/@turnkey/http): lower-level fully typed HTTP client for interacting with Turnkey API
