import { C, PARENT_TAG, USER_TAG } from "./common";

const b = (s: string) => `${C.bold}${s}${C.reset}`;
const d = (s: string) => `${C.dim}${s}${C.reset}`;

console.log(`
${b("Turnkey Earn demo — commands")}

${b("Setup (one-time)")}
  ${b("pnpm create-sub-org")}   ${PARENT_TAG}  create the end-user sub-org + wallet
  ${b("pnpm deploy-vault")} ${d("[vault] [fee-bps] [fee-wallet]")}
                        ${PARENT_TAG}  choose a vault + fee terms, deploy the fee wrapper
                        ${d("missing args prompt on the terminal")}

${b("Demo steps")}
  ${b("pnpm vaults")}           ${PARENT_TAG}  1. discover the vault catalog (✓ marks enabled)
  ${b("pnpm org-position")}     ${PARENT_TAG}  3+8. platform view: wrapper, fees, APY, total deposited
  ${b("pnpm deposit")} ${d("[usdc]")}   ${USER_TAG}  4. deposit USDC ${d("(prompts if omitted, default $1.00)")}
  ${b("pnpm positions")}        ${USER_TAG}  5+7. end-user position + accrued yield
  ${b("pnpm withdraw")} ${d("[usdc]")}  ${USER_TAG}  6. partial withdrawal ${d("(prompts if omitted, default $0.50)")}
  ${b("pnpm fees")}             ${PARENT_TAG}  platform revenue: accrued fees + turnkey/client split

  ${b("pnpm demo")}             runs the full sequence: vaults → deploy-vault → org-position
                        → deposit → positions → withdraw → positions → org-position

${b("Utilities")}
  ${b("pnpm transfer")} ${d("<to> <eth>")}  send ETH from the end-user wallet (e.g. top up a paymaster)
  ${b("pnpm commands")}         this help
`);
