# Status

The live acceptance run was done on Base Sepolia on 2026-11-04, against
production Turnkey. Results are below, followed by what is still open.

## Results

Fresh user on the final policy code: sub-org
`b3fac5c5-23a8-459b-a6e2-befcf93996ce`, deposit address
`0xbe32e9e48d08f2f12e8e9000069dc0dd92b1d7aa`.

| Check                                  | Result                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Enable from the user's session         | Works. The dashboard shows all four checks                                                                                                 |
| Sub-org shape, read through the API    | One root user (threshold 1), one non-root delegated user, two policies, one interface                                                      |
| USDC deposit swept with no manual step | 1 USDC: deposit `0x11d4abfc…a9a3ce`, sweep `0x32827dc3…1b7214`. The dashboard shows the hash                                               |
| ETH deposit swept with no manual step  | 0.0001 ETH: deposit `0x0d041339…4d05e7`, sweep `0xeca3d63b…639541`                                                                         |
| Sponsorship                            | The deposit address held 0 ETH throughout. Sweeps used `sponsor: true`                                                                     |
| `pnpm validate`                        | Send to destination allowed; send elsewhere, raw payload and USDC to the wrong recipient denied; USDC to the destination (control) allowed |
| Withdraw panel                         | **Not yet run.** See Open                                                                                                                  |

## Scope changes

**Two policies instead of one.** The scope asked for one policy. The live run
showed that cannot work: the engine does not short-circuit a condition
(`/features/policies/language#evaluation-errors-and-short-circuiting`), so a
single `eth.tx.to == '<destination>' || (USDC clause)` errors on
`eth.tx.function_name` for a plain ETH send, and the send is denied with
`OUTCOME_ERROR`. We chose two policies, one for ETH and one for USDC, over the raw
calldata check, which would have dropped the decoded-recipient check. Done criterion
2 therefore reads two policies.

**Walkthrough recording: cut.** None was made. The run was split across several
users while bugs were fixed, so there is no single take of the whole flow. It can be
recorded from a fresh login now that the flow works.

## Decisions from section 4 of the scope

**1. Where does the delegated key live?** In a server-side env var,
`TURNKEY_DA_PRIVATE_KEY`, as in `with-delegated/client-side`. Only API routes
and the scripts read it. The public half is `NEXT_PUBLIC_DA_PUBLIC_KEY`,
because the browser needs it to create the delegated user from the user's
session.

**2. ERC-20 policy condition.** The USDC policy reads the decoded recipient, using
an ABI uploaded as a smart contract interface:

```
eth.tx.to == '<usdc, lowercase>' && eth.tx.function_name == 'transfer' &&
eth.tx.contract_call_args['recipient'] == '<destination, checksummed>'
```

The ETH policy is `eth.tx.to == '<destination, lowercase>'`. The run settled the
casing: `eth.tx.to` matches lowercase, and the decoded argument matches the
checksummed spelling, on both signing and sponsored V2 sends. The raw calldata
fallback was not needed.

Only `transfer` is uploaded, because Turnkey rejects viem's full `erc20Abi` with
`provided ABI is invalid`. The run did not show which part it objects to. A
parent-org upload does not count, so Enable uploads the ABI into each sub-org,
stamped by the user's session.

The policies do not pin the chain, because the docs do not say
`eth.tx.chain_id` is populated for sponsored V2 sends. The key can only ever pay
the user's destination, on any chain.

**3. Gas sponsorship on Base Sepolia.** Works. The sweep always sends with
`sponsor: true` and fails closed: an error is logged, the UI shows `failed`, and
nothing is retried.

**4. Webhook signature verification.** Keys come from the public JWKS, matched on
`kid`. `verifyTurnkeyWebhookSignature` from `@turnkey/crypto` does the check and
returns the event id used for de-duplication. Real deliveries verified, and unsigned
posts got a 401.

## Bugs the live run found

All are fixed. The mock checks caught none of them.

| Bug                                                  | Effect                                    | Fix                                                         |
| ---------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| Full `erc20Abi` rejected                             | Enable failed at its first step           | Upload only `transfer`                                      |
| Lowercase address passed to `signWith` and `from`    | Every sweep and withdrawal would fail     | Sign with the checksummed address                           |
| `pnpm validate` counted any error as denied          | The first run's denials were false passes | Only `PolicyEnginePermissionError` counts as denied         |
| One policy with `\|\|`                               | ETH sweeps denied                         | Two policies                                                |
| Dashboard redirected before the session was restored | Any reload landed on the login page       | Wait for `ClientState.Ready`; home redirects when logged in |
| Lockfile pointed at a `viem` entry removed on `main` | CI failed at `pnpm install`               | Merged `main` and repointed the entry                       |

## Assumptions from the earlier draft

| Assumption                                                | Result                                   |
| --------------------------------------------------------- | ---------------------------------------- |
| Lowercase `eth.tx.to` matches on sponsored V2 sends       | Confirmed                                |
| Webhook `organizationId` is the owning sub-org            | Confirmed                                |
| ETH CAIP-19 is `eip155:84532/slip44:60`                   | Confirmed by the ETH sweep               |
| Stored policies are returned verbatim                     | Confirmed. The dashboard recognizes them |
| Decoded recipient matches, on signing and on sponsored V2 | Confirmed, checksummed spelling only     |
| A user session can upload an interface                    | Confirmed                                |
| The delegated key can read policies and interfaces        | Confirmed                                |

## Open

- **Withdraw panel.** Not run yet. It needs a deposit left in place with
  `SWEEP_ENABLED=false`, and a live session.
- **`Failed to refresh session`.** The SDK's automatic refresh fails near the end of
  the 15-minute session, and the user lands on the login page. The message hides the
  cause. It happens inside the SDK, and this example's part in it was not ruled out.
- **Passkey re-login.** `Unable to log in with the provided passkey` appeared when a
  test user tried to log back in, and that user had to create a new account. The
  cause is not known. Email login worked.
- **A live duplicate delivery was never seen.** De-duplication has only been checked
  offline. Each sweep is followed by a second delivery that returns 200 with
  `not a confirmed deposit`, probably the outgoing balance change.

## How this was checked

The live results are above. The mock harness (13 checks against a mock API,
including refusing a sub-org with no policies, one of the pair, an altered policy,
two destinations or a policy naming USDC) passes on the two-policy code. It tests
this code, not the real policy engine. It is not part of this PR.

## Reproduce

See "Getting started" in the README, then:

```bash
pnpm validate    # allowed, denied, denied, denied, plus an allowed control
```
