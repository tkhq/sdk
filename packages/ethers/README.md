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

  const signer = new TurnkeySigner({
    apiPrivateKey: "...",
    apiPublicKey: "...",
    baseUrl: "https://coordinator-beta.turnkey.io",
    keyId: "...",
    organizationId: "...",
  }).connect(provider);

  const chainId = await signer.getChainId();
  const address = await signer.getAddress();
  const balance = await signer.getBalance();

  console.log(`Network\n\t${network} (chainId ${chainId})`);
  console.log(`Address\n\t${address}`);
  console.log(`Balance\n\t${String(balance)}`);

  const transactionRequest = {
    to: "0x2Ad9eA1E677949a536A270CEC812D6e868C88108",
    value: ethers.utils.parseEther("0.001"),
    chainId,
    nonce: 1,
    gasLimit: 21000,
    type: 2,
  };

  const signedTx = await signer.signTransaction(transactionRequest);
  console.log(`Signed transaction\n\t${signedTx}`);

  if (balance.isZero()) {
    console.warn(
      "\nWarning: attempting to send a transaction while account balance is zero\n"
    );
  }

  const sentTx = await signer.sendTransaction(transactionRequest);

  console.log(
    `Transaction sent!\n\thttps://${network}.etherscan.io/tx/${sentTx.hash}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```
