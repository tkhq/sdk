# @turnkey/solana

## 1.0.13

### Patch Changes

- Updated dependencies [3c44c4a]
- Updated dependencies [bfc833f]
  - @turnkey/sdk-browser@1.14.0
  - @turnkey/sdk-server@2.2.0
  - @turnkey/http@2.20.0

## 1.0.12

### Patch Changes

- Updated dependencies [69d2571]
- Updated dependencies [57f9cb0]
  - @turnkey/sdk-browser@1.13.0
  - @turnkey/sdk-server@2.1.0
  - @turnkey/http@2.19.0

## 1.0.11

### Patch Changes

- Updated dependencies [755833b]
  - @turnkey/sdk-browser@1.12.1
  - @turnkey/sdk-server@2.0.1

## 1.0.10

### Patch Changes

- Updated dependencies [6695af2]
- Updated dependencies [1ebd4e2]
  - @turnkey/sdk-browser@1.12.0
  - @turnkey/sdk-server@2.0.0
  - @turnkey/http@2.18.0

## 1.0.9

### Patch Changes

- Updated dependencies [053fbfb]
  - @turnkey/sdk-browser@1.11.2
  - @turnkey/sdk-server@1.7.3
  - @turnkey/http@2.17.3

## 1.0.8

### Patch Changes

- Updated dependencies [328d6aa]
- Updated dependencies [b90947e]
- Updated dependencies [2d5977b]
- Updated dependencies [fad7c37]
  - @turnkey/sdk-browser@1.11.1
  - @turnkey/sdk-server@1.7.2
  - @turnkey/http@2.17.2

## 1.0.7

### Patch Changes

- c895c8f: Update @solana/web3.js from ^1.88.1 to ^1.95.8
- Updated dependencies [7988bc1]
- Updated dependencies [538d4fc]
- Updated dependencies [12d5aaa]
  - @turnkey/sdk-browser@1.11.0
  - @turnkey/sdk-server@1.7.1
  - @turnkey/http@2.17.1

## 1.0.6

### Patch Changes

- @turnkey/sdk-browser@1.10.2

## 1.0.5

### Patch Changes

- Updated dependencies [78bc39c]
  - @turnkey/sdk-server@1.7.0
  - @turnkey/http@2.17.0
  - @turnkey/sdk-browser@1.10.1

## 1.0.4

### Patch Changes

- 9eaf38a: Add optional org id for all signing methods

## 1.0.3

### Patch Changes

- Updated dependencies [8bea78f]
  - @turnkey/sdk-browser@1.10.0

## 1.0.2

### Patch Changes

- b55bc32: Add optional org id to addSignature function
- Updated dependencies [3dd74ac]
- Updated dependencies [1e36edf]
- Updated dependencies [4df8914]
- Updated dependencies [11a9e2f]
  - @turnkey/sdk-browser@1.9.0
  - @turnkey/sdk-server@1.6.0
  - @turnkey/http@2.16.0

## 1.0.1

### Patch Changes

- Updated dependencies [9ebd062]
  - @turnkey/sdk-browser@1.8.0
  - @turnkey/sdk-server@1.5.0
  - @turnkey/http@2.15.0

## 1.0.0

### Major Changes

- a4f0f69: Integrate @turnkey/solana with Turnkey's Sign Transaction endpoint. There are no breaking changes, but a major release felt right given this is effectively adding "full" Solana support.

  This release introduces a new method: `signTransaction`. Under the hood, this creates an activity of type `ACTIVITY_TYPE_SIGN_TRANSACTION_V2`. There is **no action required** for existing users of `addSignature`.

  - `addSignature` does not use our Policy Engine, and instead signs a transaction's message straight up
  - While `addSignature` mutates the incoming transaction by adding a signature to it directly, `signTransaction` returns a new transaction object
  - Both legacy and versioned (V0) transactions are supported

  For some examples of how you can use Turnkey's Policy Engine with Solana transactions, see https://docs.turnkey.com/concepts/policies/examples.

### Patch Changes

- Updated dependencies [abe7138]
- Updated dependencies [96d7f99]
  - @turnkey/sdk-server@1.4.2
  - @turnkey/sdk-browser@1.7.1
  - @turnkey/http@2.14.2

## 0.5.1

### Patch Changes

- Updated dependencies [ff059d5]
- Updated dependencies [ff059d5]
  - @turnkey/sdk-browser@1.7.0
  - @turnkey/sdk-server@1.4.1
  - @turnkey/http@2.14.1

## 0.5.0

### Minor Changes

- bdded80: Support awaiting consensus

### Patch Changes

- Updated dependencies [c988ed0]
- Updated dependencies [848f8d3]
  - @turnkey/sdk-browser@1.6.0
  - @turnkey/sdk-server@1.4.0
  - @turnkey/http@2.14.0

## 0.4.3

### Patch Changes

- Updated dependencies [1813ed5]
  - @turnkey/sdk-browser@1.5.0

## 0.4.2

### Patch Changes

- Updated dependencies [bab5393]
- Updated dependencies [a16073c]
- Updated dependencies [7e7d209]
  - @turnkey/sdk-browser@1.4.0

## 0.4.1

### Patch Changes

- Updated dependencies [93dee46]
  - @turnkey/http@2.13.0
  - @turnkey/sdk-browser@1.3.0
  - @turnkey/sdk-server@1.3.0

## 0.4.0

### Minor Changes

- c342954: Add compatibility with @turnkey/sdk-server and @turnkey/sdk-browser

## 0.3.10

### Patch Changes

- Updated dependencies [e2f2e0b]
  - @turnkey/http@2.12.3

## 0.3.9

### Patch Changes

- Updated dependencies [2d7e5a9]
  - @turnkey/http@2.12.2

## 0.3.8

### Patch Changes

- Updated dependencies [f17a229]
  - @turnkey/http@2.12.1

## 0.3.7

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.12.0

## 0.3.6

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.11.0

## 0.3.5

### Patch Changes

- Updated dependencies [7a9ce7a]
  - @turnkey/http@2.10.0

## 0.3.4

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.9.1

## 0.3.3

### Patch Changes

- Updated dependencies [83b62b5]
  - @turnkey/http@2.9.0

## 0.3.2

### Patch Changes

- Updated dependencies [46a7d90]
  - @turnkey/http@2.8.0

## 0.3.1

### Patch Changes

Adjust logic for signing transactions and versioned transactions to avoid typechecks (#218)

## 0.3.0

### Minor Changes

Add support for signing Solana versioned transactions (#216)

## 0.2.2

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.7.1

## 0.2.1

### Patch Changes

- Updated dependencies [d73725b]
  - @turnkey/http@2.7.0

## 0.2.0

### Minor Changes

- #202: implements `signMessage` on the Solana `TurnkeySigner`

## 0.1.1

- Fix README link

## 0.1.0

- Initial release
