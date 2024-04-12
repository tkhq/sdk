# @turnkey/ethers

[![npm](https://img.shields.io/npm/v/@turnkey/ethers?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/ethers)

[Turnkey](https://turnkey.com) Signer for [`Ethers`](https://docs.ethers.org/v5/api/signer/).

If you need a lower-level, fully typed HTTP client for interacting with Turnkey API, check out [`@turnkey/http`](/packages/http/).

API Docs: https://docs.turnkey.com/

## Getting started

```bash
$ npm install ethers @turnkey/ethers
```

```typescript
import { ethers } from "ethers";
import { TurnkeySigner } from "@turnkey/ethers";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

async function main() {
  const network = "goerli";
  const provider = new ethers.providers.InfuraProvider(network);

  const turnkeyClient = new TurnkeyClient(
    {
      baseUrl: "https://api.turnkey.com",
    },
    // This uses API key credentials.
    // If you're using passkeys, use `@turnkey/webauthn-stamper` to collect webauthn signatures:
    // new WebauthnStamper({...options...})
    new ApiKeyStamper({
      apiPublicKey: "...",
      apiPrivateKey: "...",
    })
  );

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient,
    organizationId: "...",
    signWith: "...",
  });

  // Connect it with a Provider (https://docs.ethers.org/v5/api/providers/)
  const connectedSigner = turnkeySigner.connect(provider);

  const chainId = await connectedSigner.getChainId();
  const address = await connectedSigner.getAddress();
  const balance = await connectedSigner.getBalance();
  const transactionCount = await connectedSigner.getTransactionCount();

  console.log(`Network\n\t${network} (chain ID ${chainId})`);
  console.log(`Address\n\t${address}`);
  console.log(`Balance\n\t${String(balance)}`);
  console.log(`Transaction count\n\t${transactionCount}`);

  const transactionRequest = {
    to: "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
    value: ethers.utils.parseEther("0.0001"),
    type: 2,
  };

  const signedTx = await connectedSigner.signTransaction(transactionRequest);

  console.log(`Signed transaction\n\t${signedTx}`);

  if (balance.isZero()) {
    let warningMessage =
      "\nWarning: the transaction won't be broadcasted because your account balance is zero.\n";
    if (network === "goerli") {
      warningMessage +=
        "Use https://goerlifaucet.com/ to request funds on Goerli, then run the script again.\n";
    }

    console.warn(warningMessage);
    return;
  }

  const sentTx = await connectedSigner.sendTransaction(transactionRequest);

  console.log(
    `Transaction sent!\n\thttps://${network}.etherscan.io/tx/${sentTx.hash}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

## Testing (Local)

See `.env.example` to get your local testing environment right. Run `pnpm jest` to run the tests.

## More examples

| Example                                               | Description                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [`with-ethers`](/examples/with-ethers/)               | Create a new Ethereum address, then sign and broadcast a transaction using the Ethers signer with Infura           |
| [`with-gnosis`](/examples/with-gnosis/)               | Create new Ethereum addresses, configure a 3/3 Gnosis safe, and create + execute a transaction from it             |
| [`with-uniswap`](/examples/with-uniswap/)             | Sign and broadcast a Uniswap v3 trade using the Ethers signer with Infura                                          |
| [`with-nonce-manager`](/examples/with-nonce-manager/) | Create a new Ethereum address, then sign and broadcast multiple transactions in a sequential or optimistic manner. |
| [`sweeper`](/examples/sweeper/)                       | Sweep funds from one address to a different address                                                                |
| [`deployer`](/examples/deployer/)                     | Compile and deploy a smart contract                                                                                |

## See also

- [`@turnkey/http`](/packages/http/): lower-level fully typed HTTP client for interacting with Turnkey API
