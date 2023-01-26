# @turnkey/ethers

[![npm](https://img.shields.io/npm/v/@turnkey/ethers?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/ethers)

[Turnkey](https://turnkey.io) Signer for [`Ethers`](https://docs.ethers.org/v5/api/signer/).

API Docs: https://turnkey.readme.io/

## Getting started

```bash
$ npm install ethers @turnkey/ethers
```

```typescript
import { ethers } from "ethers";
import { TurnkeySigner } from "@turnkey/ethers";

async function main() {
  const network = "goerli";
  const provider = new ethers.providers.InfuraProvider(network);

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    apiPublicKey: "...",
    apiPrivateKey: "...",
    baseUrl: "https://coordinator-beta.turnkey.io",
    organizationId: "...",
    keyId: "...",
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
