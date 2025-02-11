# @turnkey/wallet-stamper

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
