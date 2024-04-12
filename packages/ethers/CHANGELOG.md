# @turnkey/ethers

## 0.19.10

### Patch Changes

- Update protos

## 0.19.9

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.7.1

## 0.19.8

### Patch Changes

- Updated dependencies ([c3b423b], [d73725b])
  - @turnkey/api-key-stamper@0.4.0
  - @turnkey/http@2.7.0

## 0.19.7

### Patch Changes

- Updated dependencies [f9d636c]
  - @turnkey/http@2.6.2

## 0.19.6

### Patch Changes

- Updated dependencies [52e2389]
  - @turnkey/http@2.6.1

## 0.19.5

### Patch Changes

- Updated dependencies [7a3c890]
  - @turnkey/http@2.6.0

## 0.19.4

### Patch Changes

- Upgrade to Node v18 (#184)
- Updated dependencies
  - @turnkey/api-key-stamper@0.3.1
  - @turnkey/http@2.5.1

## 0.19.3

### Patch Changes

- Updated dependencies [464ac0e]
  - @turnkey/http@2.5.0

## 0.19.2

### Patch Changes

- @turnkey/http@2.4.2

## 0.19.1

### Patch Changes

- Updated dependencies [f87ced8]
  - @turnkey/http@2.4.1

## 0.19.0

### Minor Changes

- Use rollup to build ESM and CommonJS, fix ESM support (#174)

### Patch Changes

- Updated dependencies [fc5b291]
  - @turnkey/api-key-stamper@0.3.0
  - @turnkey/http@2.4.0

## 0.18.3

### Patch Changes

- Updated dependencies
  - @turnkey/api-key-stamper@0.3.0
  - @turnkey/http@2.3.1

## 0.18.2

### Patch Changes

- Updated dependencies [f1bd68a]
  - @turnkey/http@2.3.0

## 0.18.1

### Patch Changes

- Updated dependencies [ed50a0f]
- Updated dependencies
  - @turnkey/http@2.2.0

## 0.18.0

### Minor Changes

- cf8631a: Update interface to support `signWith`

This change supports signing with wallet account addresses, private key addresses, or private key IDs. See below for an example:

```js
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
```

## 0.17.4

### Patch Changes

- Updated dependencies [bb6ea0b]
  - @turnkey/http@2.1.0

## 0.17.3

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.0.0
- Updated the shape of signing

## 0.17.2

### Patch Changes

- Updated dependencies
  - @turnkey/http@1.3.0

## 0.17.1

### Patch Changes

- Update documentation as follows:
- ebf87a9: This breaking change adds support for stampers (@turnkey/api-key-stamper / @turnkey/webauthn-stamper) to integrate with API keys or passkeys, bringing it to parity with our [Viem](https://github.com/tkhq/sdk/tree/main/packages/viem) package. See the following examples for sample usage:
  - [with-ethers](https://github.com/tkhq/sdk/tree/main/examples/with-ethers): updated to use `@turnkey/api-key-stamper`
  - [with-ethers-and-passkeys](https://github.com/tkhq/sdk/tree/main/examples/with-ethers-and-passkeys): demonstrates usage of `@turnkey/webauthn-stamper`

## 0.17.0

### Minor Changes

- Add support for stampers (@turnkey/api-key-stamper / @turnkey/webauthn-stamper) to integrate with API keys or passkeys.

## 0.16.8

### Patch Changes

- Updated dependencies
  - @turnkey/http@1.2.0

## 0.16.7

### Patch Changes

- @turnkey/http@1.1.1

## 0.16.6

### Patch Changes

- Updated dependencies
  - @turnkey/http@1.1.0

## 0.16.5

### Patch Changes

- Updated dependencies [8d1d0e8]
  - @turnkey/http@1.0.1

## 0.16.4

### Patch Changes

- 46473ec: This breaking change updates generated code to be shorter and more intuitive to read:

  - generated fetchers do not include the HTTP method in their name. For example `useGetGetActivity` is now `useGetActivity`, and `usePostSignTransaction` is `useSignTransaction`.
  - input types follow the same convention (no HTTP method in the name): `TPostCreatePrivateKeysInput` is now `TCreatePrivateKeysInput`.
  - the "federated" request helpers introduced in `0.18.0` are now named "signed" requests to better reflect what they are. `FederatedRequest` is now `SignedRequest`, and generated types follow. For example: `federatedPostCreatePrivateKeys` is now `signCreatePrivateKeys`, `federatedGetGetActivity` is now `signGetActivity`, and so on.

  The name updates should be automatically suggested if you use VSCode since the new names are simply shorter versions of the old one.

- Updated dependencies [46473ec]
- Updated dependencies [38b424f]
  - @turnkey/http@1.0.0

## 0.16.3

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.18.1

## 0.16.2

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.18.0

## 0.16.1

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.17.1

## 0.16.0

### Minor Changes

- No public facing changes

### Patch Changes

- Updated dependencies [9317f51]
  - @turnkey/http@0.17.0

## 0.15.0

### Minor Changes

- No public facing changes

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.16.0
    - Fix `.postGetPrivateKey(...)`'s underlying path, while adding `@deprecated` `.postGetPrivateKeyBackwardsCompat(...)` for backward compatibility

## 0.14.1

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.15.0

## 0.14.0

### Minor Changes

- `signTransaction(...)` now verifies and drops `tx.from` if present
  - This mimics the behavior of ethers' Wallet [implementation](https://github.com/ethers-io/ethers.js/blob/f97b92bbb1bde22fcc44100af78d7f31602863ab/packages/wallet/src.ts/index.ts#L117-L121)

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.14.0

## 0.13.2

### Patch Changes

- New `TurnkeyRequestError` error class that contains rich error details
- Updated dependencies
  - @turnkey/http@0.13.2

## 0.13.1

### Patch Changes

- Error messages now contain Turnkey-specific error details
- Updated dependencies
  - @turnkey/http@0.13.1

## 0.13.0

### Minor Changes

- No public facing changes

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.13.0

## 0.12.0

### Minor Changes

- Error messages now contain Turnkey-specific error code and message

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.12.0

## 0.11.0

### Minor Changes

- `TurnkeySigner` now conforms to ethers' `TypedDataSigner` interface

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.11.0

## 0.10.0

### Minor Changes

- Added EIP-712 support for signing typed data to Ethers.
- Update Gnosis example to make use of new signing functionality.

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.10.0

## 0.9.0

### Minor Changes

- Improved support for React Native runtime (https://github.com/tkhq/sdk/pull/37)

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.9.0

## 0.8.1

### Patch Changes

- Switched from `undici` to `cross-fetch` to improve bundler compatibility
- Updated dependencies
  - @turnkey/http@0.8.1

## 0.8.0

### Minor Changes

- Added browser runtime support — `@turnkey/ethers` is now a universal (isomorphic) package
- Dropped support for Node.js v14; we recommend using Node v18+

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.8.0

## 0.7.0

### Minor Changes

- No public facing changes

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.7.0

## 0.6.0

### Minor Changes

- `#signMessage(...)`: move encoding and hashing logic to client side, `eth_sign` style

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.6.0

## 0.5.0

### Minor Changes

- Arbitrary message signing

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.5.0

## 0.4.0

### Minor Changes

- `timestamp` -> `timestampMs`

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.4.0

## 0.3.1

### Patch Changes

- Fix outdated artifact
- Updated dependencies
  - @turnkey/http@0.3.1

## 0.3.0

### Minor Changes

- `keyId` -> `privateKeyId` everywhere

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.3.0

## 0.2.0

### Minor Changes

- Change parameter from `keyId` to `privateKeyId`
- Bump API version to latest Beta

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.2.0

## 0.1.3

### Patch Changes

- Support runtime config for credentials
- Updated dependencies
  - @turnkey/http@0.1.3

## 0.1.2

### Patch Changes

- Drop internal dev dependency
- Updated dependencies
  - @turnkey/http@0.1.2

## 0.1.1

### Patch Changes

- Initial release
- Updated dependencies
  - @turnkey/http@0.1.1
