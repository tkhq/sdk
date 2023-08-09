# @turnkey/ethers

[![npm](https://img.shields.io/npm/v/@turnkey/viem?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/viem)

[Turnkey](https://turnkey.com) Custom Account for [`Viem`](https://viem.sh/docs/accounts/custom.html#custom-account).

If you need a lower-level, fully typed HTTP client for interacting with Turnkey API, check out [`@turnkey/http`](/packages/http/).

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

- [`@turnkey/example-with-viem`](/examples/with-viem/): example using this package to create, sign, and broadcast a transaction on Sepolia (Ethereum testnet)
- [`@turnkey/http`](/packages/http/): lower-level fully typed HTTP client for interacting with Turnkey API
