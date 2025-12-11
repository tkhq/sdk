# @turnkey/gas-station

## 3.1.0

### Minor Changes

- [#1108](https://github.com/tkhq/sdk/pull/1108) [`46e398e`](https://github.com/tkhq/sdk/commit/46e398e42c5eba8e38a56a41d34bf2358b20e383) Thanks [@Bijan-Massoumi](https://github.com/Bijan-Massoumi)! - Add USDC swap example with approveThenExecute and reimbursable gas station support

## 3.0.1

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-server@4.12.1

## 3.0.0

### Major Changes

- [#1089](https://github.com/tkhq/sdk/pull/1089) [`632d53c`](https://github.com/tkhq/sdk/commit/632d53c8d4600013c41b12ae3e3f4c0b9d0bc405) Thanks [@Bijan-Massoumi](https://github.com/Bijan-Massoumi)! - Updated the `@turnkey/gas-station` SDK to align with the audited smart contract changes. The audit resulted in several interface updates:

  **Contract Changes:**
  - **New contract addresses**: Updated both delegate and execution contract addresses to the newly deployed versions
  - **EIP-712 field name changes**: The canonical delegate contract interface uses simplified field names (`to`, `value`, `data`) instead of the previous descriptive names (`outputContract`, `ethAmount`, `arguments`)

  **SDK Updates:**
  - Updated `DEFAULT_EXECUTION_CONTRACT` address from `0x4ece92b06C7d2d99d87f052E0Fca47Fb180c3348` to `0x00000000008c57a1CE37836a5e9d36759D070d8c`
  - Updated `DEFAULT_DELEGATE_CONTRACT` address from `0xC2a37Ee08cAc3778d9d05FF0a93FD5B553C77E3a` to `0x000066a00056CD44008768E2aF00696e19A30084`
  - Updated EIP-712 Execution typehash field names to match the contract's canonical interface
  - Updated EIP-712 ApproveThenExecute typehash field names to match the contract's canonical interface
  - Updated Turnkey policy conditions in `buildIntentSigningPolicy` to reference the new field names (`to`, `value` instead of `outputContract`, `ethAmount`)
  - Updated documentation and examples to reflect the new field names

  **Files Modified:**
  - `packages/gas-station/src/config.ts` - Updated contract addresses
  - `packages/gas-station/src/intentBuilder.ts` - Updated EIP-712 type definitions and message objects
  - `packages/gas-station/src/policyUtils.ts` - Updated policy condition field references and documentation

## 2.0.0

### Minor Changes

- [#1045](https://github.com/tkhq/sdk/pull/1045) [`1815d04`](https://github.com/tkhq/sdk/commit/1815d044ecc0720d128acd00b21c79669eadba28) Thanks [@Bijan-Massoumi](https://github.com/Bijan-Massoumi)! - add approveThenExecute functionality to gas station

### Patch Changes

- Updated dependencies [[`67b03a5`](https://github.com/tkhq/sdk/commit/67b03a5d9ab1b6eabfb0b41938ac91365b5dcd9b)]:
  - @turnkey/sdk-server@4.12.0

## 1.0.0

### Patch Changes

- Updated dependencies [[`71cdca3`](https://github.com/tkhq/sdk/commit/71cdca3b97ba520dc5327410a1e82cf9ad85fb0e), [`9fbd5c4`](https://github.com/tkhq/sdk/commit/9fbd5c459782dc3721dd0935d0a4458babce258b)]:
  - @turnkey/sdk-server@4.11.0

## 0.3.4

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-server@4.10.5

## 0.3.3

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-server@4.10.4

## 0.3.2

### Patch Changes

- Updated dependencies [[`9df42ad`](https://github.com/tkhq/sdk/commit/9df42adc02c7ff77afba3b938536e79b57882ef1)]:
  - @turnkey/sdk-server@4.10.3

## 0.3.1

### Patch Changes

- [#1011](https://github.com/tkhq/sdk/pull/1011) [`921bf1e`](https://github.com/tkhq/sdk/commit/921bf1ed4fa276ade0872146b6659db881b92c99) Thanks [@Bijan-Massoumi](https://github.com/Bijan-Massoumi)! - update readme with correct install command

## 0.3.0

### Minor Changes

- [#1003](https://github.com/tkhq/sdk/pull/1003) [`574abcf`](https://github.com/tkhq/sdk/commit/574abcfba169603a64775f9db813faed0b4c915b) Thanks [@Bijan-Massoumi](https://github.com/Bijan-Massoumi)! - Replace `0x{string}` using with viem Hex + make chain_id configurable on signAuthorizations

## 0.2.0

### Minor Changes

- [#991](https://github.com/tkhq/sdk/pull/991) [`b9550d7`](https://github.com/tkhq/sdk/commit/b9550d79de22d3881b4abe64f2a6ca93b90593c4) Thanks [@Bijan-Massoumi](https://github.com/Bijan-Massoumi)! - create initial beta B.Y.O.P (Bring Your Own Paymaster) TK Gas Station Client
