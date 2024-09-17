---
"@turnkey/http": minor
---

Add new helpers and update types and errors

- `getSignatureFromActivity` returns the signature corresponding to a completed activity
- `getSignedTransactionFromActivity` returns the signed transaction corresponding to a completed activity
- `assertActivityCompleted` checks the state of an activity and throws an error if the activity either requires consensus or is otherwise not yet completed
- `TERMINAL_ACTIVITY_STATUSES` is a const containing all terminal activity statuses. Useful for checking on an activity
- `TurnkeyActivityError` now uses `undefined` instead of `null`
- Export some additional types: `TActivity`, `TActivityId`, `TActivityStatus`, `TActivityType`
