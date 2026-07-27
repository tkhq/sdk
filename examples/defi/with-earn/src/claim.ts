import { createAccount } from "@turnkey/viem";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Account,
} from "viem";
import { base } from "viem/chains";
import {
  header,
  newClient,
  PARENT_TAG,
  requireEnv,
  resolveWrapper,
  usd,
} from "./common";

const wrapperAbi = parseAbi([
  "function performanceFeeRecipient() view returns (address)",
]);

const splitterAbi = parseAbi([
  "function releasable(address token, address account) view returns (uint256)",
  "function release(address token, address account)",
]);

// Client revenue payout: the accrued client performance fee sits in the fee
// splitter as wrapper shares releasable to your fee wallet. `release` is a
// permissionless PaymentSplitter call that pushes those shares to the payee —
// here the fee wallet claims its own revenue. The shares are ERC-4626 wrapper
// shares; redeem them for the underlying separately once claimed.
async function main() {
  const { client, organizationId } = newClient("PARENT");

  header("Claim fees (client revenue payout)", PARENT_TAG);

  const vault = await resolveWrapper(client, organizationId);
  const wrapper = vault.wrapperAddress as `0x${string}`;
  const clientFeeWallet = requireEnv("CLIENT_FEE_WALLET") as `0x${string}`;

  const transport = http("https://mainnet.base.org");
  const rpc = createPublicClient({ chain: base, transport });

  const splitter = await rpc.readContract({
    address: wrapper,
    abi: wrapperAbi,
    functionName: "performanceFeeRecipient",
  });

  const releasable = await rpc.readContract({
    address: splitter,
    abi: splitterAbi,
    functionName: "releasable",
    args: [wrapper, clientFeeWallet],
  });

  console.log(`💸 Wrapper ${wrapper}`);
  console.log(`   splitter:          ${splitter}`);
  console.log(`   client fee wallet: ${clientFeeWallet}`);
  console.log(`   releasable now:    ${usd(releasable.toString())}`);

  if (releasable === 0n) {
    console.log("\nNothing to claim yet — fees accrue as the position earns.");
    return;
  }

  // The fee wallet signs its own claim. `release` is permissionless (any
  // funded account can trigger the payout), so the wallet only needs a little
  // ETH on Base for gas.
  const account = (await createAccount({
    client,
    organizationId,
    signWith: clientFeeWallet,
  })) as Account;

  const walletClient = createWalletClient({ account, chain: base, transport });

  console.log(
    `\n📤 Releasing ${usd(releasable.toString())} to ${clientFeeWallet}…`,
  );
  const hash = await walletClient.writeContract({
    account,
    chain: base,
    address: splitter,
    abi: splitterAbi,
    functionName: "release",
    args: [wrapper, clientFeeWallet],
  });

  console.log(`   tx: https://basescan.org/tx/${hash}`);
  const receipt = await rpc.waitForTransactionReceipt({ hash });
  console.log(`✅ ${receipt.status} in block ${receipt.blockNumber}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
