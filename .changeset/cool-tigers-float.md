---
"@turnkey/solana": major
---

Integrate @turnkey/solana with Turnkey's Sign Transaction endpoint. There are no breaking changes, but a major release felt right given this is effectively adding "full" Solana support.

This release introduces a new method: `signTransaction`. Under the hood, this creates an activity of type `ACTIVITY_TYPE_SIGN_TRANSACTION_V2`. There is **no action required** for existing users of `addSignature`.

- `addSignature` does not use our Policy Engine, and instead signs a transaction's message straight up
- while `addSignature` mutates the incoming transaction by adding a signature to it directly, `signTransaction` returns a new transaction object
- Both legacy and versioned (V0) transactions are supported

For some examples of how you can use Turnkey's Policy Engine with Solana transactions, see https://docs.turnkey.com/concepts/policies/examples.
