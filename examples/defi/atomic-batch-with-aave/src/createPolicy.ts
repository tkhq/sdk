import {
  AaveV3BaseSepolia,
  MiscBaseSepolia,
} from "@bgd-labs/aave-address-book";
import { turnkeyClient, signWith } from "./util";

/**
 * Showcase the policy engine on the batch path: allow a NON-ROOT user to
 * submit ETH_SEND_TRANSACTION_V2 activities that touch ONLY the DeFi
 * interactions this example uses — the Aave Pool, USDC, and the faucet,
 * restricted to the exact function selectors of the flow.
 *
 * eth.tx.* predicates are evaluated against EVERY call in a V2 batch with
 * all-or-nothing semantics: if any single call targets a contract or
 * selector outside the allowlist, the entire batch is denied. (Verified
 * live: a batch mixing one allowed approve with one call to an unlisted
 * address is denied as a unit; USDC.transfer is denied even though USDC
 * itself is allowlisted.)
 *
 * Run this with ROOT credentials in .env.local, then hand the non-root
 * user's API keys to whatever service should be allowed to press the
 * button — it can faucet, enter, and exit, and nothing else.
 */

// 4-byte selectors of the only functions the non-root user may call.
const ALLOWED_SELECTORS = [
  "0xc6c3bbe6", // mint(address,address,uint256)            — faucet
  "0x095ea7b3", // approve(address,uint256)                 — USDC
  "0x617ba037", // supply(address,uint256,address,uint16)   — Aave Pool
  "0xa415bcad", // borrow(address,uint256,uint256,uint16,address)
  "0x573ade81", // repay(address,uint256,uint256,address)
  "0x69328dec", // withdraw(address,uint256,address)
];

async function main() {
  const client = turnkeyClient();

  // The id of the non-root user that will submit the batches
  const userId = process.env.NONROOT_USER_ID!;

  const allowedContracts = [
    AaveV3BaseSepolia.ASSETS.USDC.UNDERLYING,
    AaveV3BaseSepolia.POOL,
    MiscBaseSepolia.FAUCET,
  ].map((a) => `'${a.toLowerCase()}'`);

  const policyName =
    "Allow non-root user only the example's DeFi batch interactions";
  const effect = "EFFECT_ALLOW";
  const consensus = `approvers.any(user, user.id == '${userId}')`;
  // Note: selector-based calldata matching (eth.tx.data[0..10]) is used here
  // for a self-contained example. The generally preferred production path is
  // to upload each contract's ABI to Turnkey and write conditions against the
  // decoded call, e.g. eth.tx.function_name == 'supply' and
  // eth.tx.contract_call_args['amount'] <= 100000000. That gives readable,
  // parameter-level rules instead of raw byte matching. See:
  // https://docs.turnkey.com/features/policies/smart-contract-interfaces
  const condition = [
    `activity.type == 'ACTIVITY_TYPE_ETH_SEND_TRANSACTION_V2'`,
    `eth.tx.from == '${signWith().toLowerCase()}'`,
    `eth.tx.to in [${allowedContracts.join(", ")}]`,
    `eth.tx.data[0..10] in [${ALLOWED_SELECTORS.map((s) => `'${s}'`).join(", ")}]`,
  ].join(" && ");

  const { policyId } = await client.createPolicy({
    policyName,
    condition,
    consensus,
    effect,
    notes:
      "Per-call enforcement: every call in the batch must match the contract and " +
      "selector allowlists or the whole batch is denied.",
  });

  console.log(
    [
      `New policy created!`,
      `- Name: ${policyName}`,
      `- Policy ID: ${policyId}`,
      `- Effect: ${effect}`,
      `- Consensus: ${consensus}`,
      `- Condition: ${condition}`,
      ``,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
