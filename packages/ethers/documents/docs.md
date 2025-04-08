---
title: "Ethers"
description: "[`@turnkey/ethers`](https://www.npmjs.com/package/@turnkey/ethers) exports a `TurnkeySigner` that serves as a drop-in replacement for an Ethers signer."
mode: wide
---

Out of the box, it supports `{ signTransaction | signMessage | signTypedData }`. See full implementation [here](https://github.com/tkhq/sdk/tree/main/packages/ethers) for more details and examples. Note that you must **bring your own provider and connect it** to the TurnkeySigner.

```js
// Initialize a Turnkey Signer
const turnkeySigner = new TurnkeySigner({
  ...
});

// Bring your own provider (such as Alchemy or Infura: https://docs.ethers.org/v6/api/providers/)
const network = "goerli";
const provider = new ethers.providers.InfuraProvider(network);
const connectedSigner = turnkeySigner.connect(provider);
```
