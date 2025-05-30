---
title: "Cosmjs"
---

# @turnkey/cosmjs

[![npm](https://img.shields.io/npm/v/@turnkey/cosmjs?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/cosmjs)

Experimental [Turnkey](https://turnkey.com) Cosmos Signer for [`CosmJS`](https://github.com/cosmos/cosmjs):

- `TurnkeyDirectWallet` is a drop-in replacement for [`DirectSecp256k1Wallet`](https://github.com/cosmos/cosmjs/blob/e8e65aa0c145616ccb58625c32bffe08b46ff574/packages/proto-signing/src/directsecp256k1wallet.ts#LL14C14-L14C35) that conforms to the `OfflineDirectSigner` interface.

If you need a lower-level, fully typed HTTP client for interacting with Turnkey API, check out [`@turnkey/http`](https://www.npmjs.com/package/@turnkey/http).

API Docs: https://docs.turnkey.com/

## Getting started

```bash
$ npm install @turnkey/cosmjs
```

## Examples

| Example                                                                     | Description                                                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`with-cosmjs`](https://github.com/tkhq/sdk/tree/main/examples/with-cosmjs) | Create a new Cosmos address, then sign and broadcast a transaction on Celestia testnet via CosmJS |

## See also

- [`@turnkey/http`](https://www.npmjs.com/package/@turnkey/http): lower-level fully typed HTTP client for interacting with Turnkey API
