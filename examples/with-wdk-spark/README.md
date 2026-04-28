# Example: `with-wdk-spark`

Demonstrates [Spark](https://spark.money) operations through Tether's
[`@tetherto/wdk-wallet-spark`](https://github.com/tetherto/wdk-wallet-spark)
wallet API, with **Turnkey as the key custodian**. Private keys never leave
Turnkey's enclave — all signing happens via Turnkey activities.

## What this example shows

The WDK wraps `@buildonspark/spark-sdk` in a higher-level
`WalletManagerSpark` / `WalletAccountSpark` API. By default, it derives keys
locally from a BIP-39 seed and signs with `Bip44SparkSigner`.

This example replaces the local-key flow with Turnkey:

- `TurnkeyWalletManagerSpark` — drop-in for `WalletManagerSpark` that takes
  Turnkey wallet configs instead of a seed.
- `TurnkeyWalletAccountSpark` — extends `WalletAccountSpark`. Constructs the
  underlying `SparkWallet` with our `TurnkeySparkSigner` and overrides
  `sendTransaction` / `withdraw` so that key tweaks and FROST signing run
  atomically inside the enclave.

## Operations

| Script | What it does |
|--------|-------------|
| `pnpm run setup:e2e` | Create sender + receiver Spark wallets (Turnkey-owned) and Bitcoin regtest L1 accounts |
| `pnpm run e2e:regtest` | Deposit BTC, transfer through Spark, claim, and withdraw — all via the WDK API |

## Prerequisites

Same as `with-spark` — see that README for Turnkey signup, `.env.local`
setup, and Lightspark regtest faucet usage.
