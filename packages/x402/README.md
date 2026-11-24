# @turnkey/x402

Helpers for paying with [x402](https://github.com/coinbase/x402) v2 from a Turnkey wallet, using the `exact` EVM scheme with EIP-3009 `transferWithAuthorization` (USDC).

Typed data is signed through an account from `@turnkey/viem`, which sends it to Turnkey as `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2` with `PAYLOAD_ENCODING_EIP712`. Header encoding and the x402 client come from the official `@x402/core`, `@x402/evm` and `@x402/fetch` packages.

## Paying with the official x402 client

```ts
import { createAccount } from "@turnkey/viem";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { createX402Signer } from "@turnkey/x402";

const account = await createAccount({ client, organizationId, signWith });
const x402 = new x402Client().register(
  "eip155:8453",
  new ExactEvmScheme(createX402Signer(account)),
);
const response = await wrapFetchWithPayment(fetch, x402)(url);
```

## Signing an authorization directly

```ts
import {
  boundNonce,
  signTransferWithAuthorization,
  transferWithAuthorizationTypedData,
  usdMinorToUsdcAtomic,
} from "@turnkey/x402";

const typedData = transferWithAuthorizationTypedData({
  token: { address: usdc, chainId: 8453, name: "USD Coin", version: "2" },
  from: account.address,
  to: payTo,
  value: usdMinorToUsdcAtomic(150n), // $1.50
  validAfter: 0n,
  validBefore: BigInt(Math.floor(Date.now() / 1000) + 60),
  nonce: boundNonce({ orderId: "order-1", payTo }),
});
const { signature, digest } = await signTransferWithAuthorization(
  account,
  typedData,
);
```

`decodePaymentRequiredHeader` and `encodePaymentSignatureHeader` are re-exported from `@x402/core/http`. The decoder does not validate the header's fields, so do not trust them without checking.

`boundNonce(binding)` is the SHA-256 of the RFC 8785 canonical JSON of a string-to-string map, so a payment can be tied to an order or request that a verifier can recompute.

## Wallet policy

`x402WalletPolicy({ walletId, chainId, token, payer, capAtomic, approverCredentialId?, coApproverUserId? })` returns a Turnkey ALLOW policy (`effect`, `condition`, and `consensus` when an approver is given). Its condition matches only the following fields, all of which must hold:

- `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2` with `PAYLOAD_ENCODING_EIP712`,
- primary type `TransferWithAuthorization`,
- the given wallet, chain and token contract,
- `from` equal to `payer`, and `value` at most `capAtomic` per signature.

`approverCredentialId` requires that credential among the approvers' credentials; `coApproverUserId` requires that user's approval. Ids must be Turnkey UUIDs and `capAtomic` a `bigint` in the uint256 range; anything else throws.

The condition has not been tested against Turnkey's policy engine. Check it in a test organization (both an allowed and a denied signature) before relying on it.

### What the policy cannot enforce

The policy sees one signature at a time and cannot know the payment it is for. These need checks outside Turnkey, for example in the service that requests the signature:

- the exact payee (`to`) and the exact amount of each payment: the policy only caps `value`, and a cap per signature is not a spending limit across signatures;
- the time window (`validAfter`, `validBefore`): a long-lived authorization is allowed;
- the nonce binding: the policy cannot recompute `boundNonce` from the order or request it should commit to.

It also does not restrict other activity types: combine it with the absence of broader ALLOW policies for the same wallet.
