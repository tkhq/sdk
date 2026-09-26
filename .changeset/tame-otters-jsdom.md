---
"@turnkey/react-wallet-kit": patch
---

Fix `pnpm test` failing to run `src/tests/timers-test.ts` due to a missing `jest-environment-jsdom` devDependency. No runtime behavior change; test-only fix.
