---
"@turnkey/gas-station": major
---

Updated the `@turnkey/gas-station` SDK to align with the audited smart contract changes. The audit resulted in several interface updates:

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
