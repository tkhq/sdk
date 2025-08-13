# @turnkey/wallet-stamper

## 1.0.8

### Patch Changes

- Updated dependencies [[`6cde41c`](https://github.com/tkhq/sdk/commit/6cde41cfecdfb7d54abf52cc65e28ef0e2ad6ba3)]:
  - @turnkey/crypto@2.5.0

## 1.0.7

### Patch Changes

- Updated dependencies [[`6cbff7a`](https://github.com/tkhq/sdk/commit/6cbff7a0c0b3a9a05586399e5cef476154d3bdca)]:
  - @turnkey/crypto@2.4.3

## 1.0.6

### Patch Changes

- Updated dependencies [[`c5cdf82`](https://github.com/tkhq/sdk/commit/c5cdf8229da5da1bd6d52db06b2fe42826e96d57), [`fa46701`](https://github.com/tkhq/sdk/commit/fa467019eef34b5199372248edff1e7a64934e79)]:
  - @turnkey/crypto@2.4.2

## 1.0.5

### Patch Changes

- Updated dependencies [[`878e039`](https://github.com/tkhq/sdk/commit/878e03973856cfec83e6e3fda5b76d1b64943628)]:
  - @turnkey/crypto@2.4.1

## 1.0.4

### Patch Changes

- [#659](https://github.com/tkhq/sdk/pull/659) [`5afbe51`](https://github.com/tkhq/sdk/commit/5afbe51949bdd1997fad083a4c1e4272ff7409dc) Author [@turnekybc](https://github.com/turnekybc) - export types and models from @turnkey/sdk-browser

- Updated dependencies [[`40c4035`](https://github.com/tkhq/sdk/commit/40c40359ec7096d0bca39ffc93e89361b3b11a1a), [`10ee5c5`](https://github.com/tkhq/sdk/commit/10ee5c524b477ce998e4fc635152cd101ae5a9cc)]:
  - @turnkey/encoding@0.5.0
  - @turnkey/crypto@2.4.0

## 1.0.3

### Patch Changes

- Updated dependencies [2bc0046]
  - @turnkey/crypto@2.3.1

## 1.0.2

### Patch Changes

- c895c8f: Update @solana/web3.js from ^1.88.1 to ^1.95.8
  - @turnkey/crypto@2.3.0

## 1.0.1

### Patch Changes

- Updated dependencies [668edfa]
  - @turnkey/crypto@2.3.0

## 1.0.0

### Major Changes

- Renamed `recoverPublicKey` to `getPublicKey` on the `EthereumWallet` interface to improve clarity and consistency across wallet interfaces

- Changed `getPublicKey` method signature to take no parameters

  ```typescript
  // Old method signature
  recoverPublicKey(message: string): Promise<string>;
  ```

  ```typescript
  // New method signature
  getPublicKey(): Promise<string>;
  ```

- Added an `EthereumWallet` implementation as a helper to simplify support for Ethereum wallets:

  ```typescript
  import { EthereumWallet } from "@turnkey/wallet-stamper";

  const wallet = new EthereumWallet();

  // Instantiate the WalletStamper with the EthereumWallet
  const walletStamper = new WalletStamper(wallet);

  // Instantiate the TurnkeyClient with the WalletStamper
  const client = new TurnkeyClient({ baseUrl: BASE_URL }, walletStamper);
  ```

### Patch Changes

- Updated dependencies [8bea78f]
- @turnkey/crypto@2.2.0

## 0.0.5

### Patch Changes

- Updated dependencies [e5c4fe9]
- @turnkey/encoding@0.4.0

## 0.0.4

### Patch Changes

- Updated dependencies [93666ff]
- @turnkey/encoding@0.3.0

## 0.0.3

### Patch Changes

- Updated dependencies [2d7e5a9]
- Updated dependencies [f4b607f]
- @turnkey/encoding@0.2.1

## 0.0.2

### Patch Changes

- 68a14dd: Initial release! 🎉
