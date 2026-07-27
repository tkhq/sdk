# Example: Solana CCTP bridge with three Turnkey signers

This example bridges native USDC from Solana to Base using Circle CCTP V2 and
Circle's Forwarding Service. It exercises the Cash Lite multi-signer shape:
three distinct Turnkey addresses submitted through `solSendTransactionV2`:

```ts
signWiths: [rentPayer, signWith, eventSigner];
```

1. `SIGN_WITH` owns the USDC and authorizes the burn.
2. A fresh `MessageSent` event account signs its own on-chain creation.
3. A stable org rent-payer wallet is the Solana fee payer and CCTP
   `event_rent_payer`. The script finds or creates that wallet/account; prefund
   it with SOL when running without Gas Station sponsorship.

Optional Turnkey Gas Station sponsorship (`sponsor: true`) can still be enabled
on top of the dedicated rent payer — useful for validating that path end to end.

Circle burns USDC on Solana, attests the message, and submits the destination
mint on Base. The script polls Circle's API until the Base transaction hash is
available, so no Base private key or Base gas is required.

## Prerequisites

- Node.js 22+
- Turnkey API credentials and an organization ID
- A Turnkey Solana address with Devnet USDC (`SIGN_WITH`)
- A Base Sepolia recipient address
- API-key permissions to create wallets and wallet accounts in the organization
- SOL on the rent-payer address when sponsorship is off (the script prints that
  address on first run)

For mainnet, use mainnet USDC, SOL, and a Base recipient instead.

The generated event signer is one-time use. The CCTP instruction creates it
on-chain and assigns it to Circle's MessageTransmitter program. The script
reuses a stable Turnkey wallet but derives a new Solana account within it for
every confirmed transfer. Circle permits reclaiming the event account only
after its five-day safety window; this example does not reclaim it.

## Configure

From the repository root, install and build dependencies, then enter this
example:

```bash
pnpm install -r
pnpm run build-all
cd examples/transaction-management/solana-cctp-bridge
cp .env.local.example .env.local
```

Set the following values in `.env.local`:

- `API_PUBLIC_KEY`, `API_PRIVATE_KEY`, `BASE_URL`, and `ORGANIZATION_ID`: the
  same Turnkey credentials used by the Solana Sweeper example.
- `SIGN_WITH`: the funded Turnkey Solana USDC owner address.
- `CCTP_WALLET_NAME`: optional stable wallet slug for fresh MessageSent event
  signers.
- `RENT_PAYER_WALLET_NAME`: optional stable wallet slug for the dedicated rent /
  fee payer. Created on first run if missing.
- `DESTINATION_ADDRESS`: the EVM address that receives USDC on Base.
- `AMOUNT_USDC`: the net amount the destination should receive, with up to six
  decimal places. The script fetches the current Circle fees and burns this
  amount plus those fees.
- `SOLANA_NETWORK`: `devnet` for Base Sepolia or `mainnet` for Base.

Devnet USDC is available from the [Circle faucet](https://faucet.circle.com/).

## Run

```bash
pnpm start
```

The script quotes the current forwarding fee, shows the complete burn amount,
and asks for confirmation. It then resolves the rent-payer account, derives a
fresh event signer, verifies that the event account does not exist on-chain,
and submits all three required signatures through `solSendTransactionV2`.

## CCTP implementation notes

This example follows Circle's official
[Solana-to-EVM CCTP quickstart](https://developers.circle.com/cctp/quickstarts/transfer-usdc-solana-to-arc)
and uses the published CCTP V2
[Solana program addresses and interfaces](https://developers.circle.com/cctp/references/solana-programs).
Account ordering for `deposit_for_burn_with_hook` matches Circle's
TokenMessengerMinterV2 IDL (`owner`, then `event_rent_payer`, then the
MessageSent event account as a later signer).
Solana is Circle domain 5 and Base is domain 6, as listed in Circle's
[supported chains and domains](https://developers.circle.com/cctp/concepts/supported-chains-and-domains).
The forwarding fee is fetched immediately before the transaction following
Circle's [Forwarding Service guide](https://developers.circle.com/cctp/howtos/transfer-usdc-with-forwarding-service).
