import type { TurnkeyApiClient, v1AssetBalance } from "@turnkey/sdk-server";
import { encodeFunctionData, erc20Abi } from "viem";

import {
  apyText,
  caip2Of,
  chainName,
  collectedApy,
  type EnabledVault,
  isSolana,
  newClient,
  requireEnv,
  sleep,
  txLink,
  units,
} from "./common";
import {
  EXCLUDED_SYMBOLS,
  FEE_SPONSORSHIP,
  FIXED_RATE,
  INPUT_CHAINS,
  MAX_SLIPPAGE_BPS,
  RETURN_ASSET,
  SWAP_WAIT_MINUTES,
  type Caip2,
} from "./config";

// Each request type accepts its own set of chains (Earn, for example, only the
// chains Earn supports), so values are narrowed to the request's type.
type EthCaip2 = Parameters<TurnkeyApiClient["ethSendTransaction"]>[0]["caip2"];
type SolCaip2 = Parameters<TurnkeyApiClient["solSendTransaction"]>[0]["caip2"];
export type EarnCaip2 = Parameters<TurnkeyApiClient["earnDeposit"]>[0]["caip2"];

// ─── The customer's sub-org ────────────────────────────────────────────────

const SUB_ORG_PREFIX = "with-earn-delegated-";
export const SUB_ORG_NAME = `${SUB_ORG_PREFIX}demo`;
export const DEPOSIT_WALLET = "Deposit wallet";
export const EARN_WALLET = "Earn wallet";

// Each wallet holds one EVM account (the same address on every EVM chain) and
// one Solana account.
export const WALLET_ACCOUNTS = [
  {
    curve: "CURVE_SECP256K1" as const,
    pathFormat: "PATH_FORMAT_BIP32" as const,
    path: "m/44'/60'/0'/0/0",
    addressFormat: "ADDRESS_FORMAT_ETHEREUM" as const,
  },
  {
    curve: "CURVE_ED25519" as const,
    pathFormat: "PATH_FORMAT_BIP32" as const,
    path: "m/44'/501'/0'/0'",
    addressFormat: "ADDRESS_FORMAT_SOLANA" as const,
  },
];

export type Customer = {
  subOrgId: string;
  depositEvm: string;
  depositSol: string;
  earnEvm: string;
  earnSol: string;
};

// findCustomerOrgId looks up the customer's sub-org with the parent key, by
// the customer's public key (it goes in when the sub-org is created, so even a
// run that failed halfway is found). Only the public key is needed, so the
// delegated scripts never load the customer's private key.
export async function findCustomerOrgId(
  parent: TurnkeyApiClient,
  parentOrgId: string,
): Promise<string | null> {
  const [byKey, byName] = await Promise.all([
    parent.getSubOrgIds({
      organizationId: parentOrgId,
      filterType: "PUBLIC_KEY",
      filterValue: requireEnv("CUSTOMER_API_PUBLIC_KEY"),
    }),
    parent.getSubOrgIds({
      organizationId: parentOrgId,
      filterType: "NAME",
      filterValue: SUB_ORG_NAME,
    }),
  ]);

  const ids = byKey.organizationIds ?? [];
  if (ids.length === 0) return null;
  if (ids.length > 1) {
    throw new Error(
      `found ${ids.length} sub-orgs for CUSTOMER_API_PUBLIC_KEY (${ids.join(", ")}); expected one`,
    );
  }
  if (!(byName.organizationIds ?? []).includes(ids[0]!)) {
    throw new Error(
      `CUSTOMER_API_PUBLIC_KEY belongs to sub-org ${ids[0]}, which isn't named ${SUB_ORG_NAME}. Use a fresh customer key for this demo.`,
    );
  }
  return ids[0]!;
}

// openCustomer is how every script after onboarding starts: find the
// customer's sub-org (with the parent key), then make a client for `role`
// inside it and load the wallets and asset lists.
export async function openCustomer(role: "CUSTOMER" | "DELEGATED") {
  const { client: parent, organizationId } = newClient("PARENT");
  const subOrgId = await findCustomerOrgId(parent, organizationId);
  if (!subOrgId) {
    throw new Error("no customer sub-org yet; run `pnpm onboard-customer`");
  }
  const { client } = newClient(role, subOrgId);
  const [customer, lists] = await Promise.all([
    loadCustomer(client, subOrgId),
    supportedAssets(client, subOrgId),
  ]);
  return { client, subOrgId, customer, lists };
}

// loadCustomer finds the deposit and Earn wallets by name and their accounts
// by address format.
export async function loadCustomer(
  client: TurnkeyApiClient,
  subOrgId: string,
): Promise<Customer> {
  const { wallets } = await client.getWallets({ organizationId: subOrgId });

  const accountsOf = async (walletName: string) => {
    const wallet = wallets.find((w) => w.walletName === walletName);
    if (!wallet) {
      throw new Error(
        `wallet "${walletName}" not found; run \`pnpm onboard-customer\``,
      );
    }
    const { accounts } = await client.getWalletAccounts({
      organizationId: subOrgId,
      walletId: wallet.walletId,
    });
    const find = (format: string) => {
      const account = accounts.find((a) => a.addressFormat === format);
      if (!account) {
        throw new Error(`wallet "${walletName}" has no ${format} account`);
      }
      return account.address;
    };
    return {
      evm: find("ADDRESS_FORMAT_ETHEREUM"),
      sol: find("ADDRESS_FORMAT_SOLANA"),
    };
  };

  const deposit = await accountsOf(DEPOSIT_WALLET);
  const earn = await accountsOf(EARN_WALLET);

  return {
    subOrgId,
    depositEvm: deposit.evm,
    depositSol: deposit.sol,
    earnEvm: earn.evm,
    earnSol: earn.sol,
  };
}

// ─── Supported assets ─────────────────────────────────────────────────────

export type Asset = {
  caip19: string;
  caip2: string;
  symbol: string;
  decimals: number;
};

export type Target = Asset & {
  wrapperAddress: string;
  netApyPct: string;
  rewardsApyPct: string | undefined;
  liquidity: string | undefined;
  name: string;
};

type AssetLists = {
  // What the watcher accepts and can swap from: every stablecoin on Turnkey's
  // list on the input chains, minus EXCLUDED_SYMBOLS. No vault needed.
  inputs: Asset[];
  // What the watcher can swap into and invest in: the assets of enabled
  // wrappers that are also inputs.
  targets: Target[];
  // What redeem returns (USDC on Base).
  returnAsset: Asset;
};

export const sameAsset = (a: string, b: string) =>
  isSolana(a) ? a === b : a.toLowerCase() === b.toLowerCase();

// supportedAssets derives both lists from Turnkey at run time.
export async function supportedAssets(
  client: TurnkeyApiClient,
  organizationId: string,
): Promise<AssetLists> {
  if (isSolana(RETURN_ASSET.caip2)) {
    throw new Error(
      `RETURN_ASSET must be an EVM asset; the return transfer and its policy are EVM only (see config.ts)`,
    );
  }
  const excluded = EXCLUDED_SYMBOLS.map((s) => s.toUpperCase());

  const perChain = await Promise.all(
    INPUT_CHAINS.map(async (caip2) => {
      const { assets = [] } = await client.listSupportedAssets({
        organizationId,
        caip2,
      });
      return assets
        .filter(
          (a) =>
            a.stable === true &&
            a.caip19 &&
            a.symbol &&
            !excluded.includes(a.symbol.toUpperCase()),
        )
        .map((a) => ({
          caip19: a.caip19!,
          caip2,
          symbol: a.symbol!,
          decimals: a.decimals ?? 6,
        }));
    }),
  );
  const inputs = perChain.flat();

  const { enabledVaults = [] } = await client.listEarnEnabledVaults({
    organizationId,
  });
  const targets: Target[] = [];
  for (const v of enabledVaults as EnabledVault[]) {
    if (!v.wrapperAddress || !v.caip19 || v.depositsDisabled) continue;
    if (v.deployStatus && !/COMPLETED/i.test(v.deployStatus)) continue;
    const asset = inputs.find((a) => sameAsset(a.caip19, v.caip19!));
    if (!asset) continue;
    targets.push({
      ...asset,
      wrapperAddress: v.wrapperAddress,
      netApyPct: v.netApyPct ?? "0",
      rewardsApyPct: v.rewardsApyPct,
      liquidity: v.liquidity,
      name: v.name ?? `${v.provider} vault`,
    });
  }

  const returnAsset = inputs.find(
    (a) =>
      a.caip2 === RETURN_ASSET.caip2 &&
      a.symbol.toUpperCase() === RETURN_ASSET.symbol,
  );
  if (!returnAsset) {
    throw new Error(
      `${RETURN_ASSET.symbol} on ${chainName(RETURN_ASSET.caip2)} isn't in the input list; check config.ts`,
    );
  }

  return { inputs, targets, returnAsset };
}

// printAssetLists summarizes the inputs by chain and lists the vaults.
export function printAssetLists(lists: AssetLists) {
  const byChain = new Map<string, string[]>();
  for (const a of lists.inputs) {
    byChain.set(a.caip2, [...(byChain.get(a.caip2) ?? []), a.symbol]);
  }
  console.log(
    `🪙 Accepted stablecoins: ${lists.inputs.length} on ${byChain.size} chains`,
  );
  for (const [caip2, symbols] of byChain) {
    console.log(`   ${chainName(caip2).padEnd(16)} ${symbols.join(", ")}`);
  }
  printVaults(lists.targets, "\n🏦 Vaults the platform can invest in:");
  console.log(
    `\n↩️  Redeem returns ${lists.returnAsset.symbol} on ${chainName(lists.returnAsset.caip2)}\n`,
  );
}

// printVaults lists vaults best APY first, optionally limited to one chain.
export function printVaults(
  targets: Target[],
  title: string,
  onlyChain?: string,
) {
  console.log(title);
  for (const t of rankVaults(targets, onlyChain)) {
    console.log(
      `   ${t.name} (${t.symbol} on ${chainName(t.caip2)}): ${apyText(t)}`,
    );
  }
}

// refreshTargets re-reads the enabled vaults and returns the given targets with
// their current APY, liquidity and deposit state. It only ever returns
// wrappers that were already targets, because those are the ones the policies
// allow; a vault enabled since onboarding needs `pnpm onboard-customer` first.
export async function refreshTargets(
  client: TurnkeyApiClient,
  organizationId: string,
  targets: Target[],
): Promise<Target[]> {
  const { enabledVaults = [] } = await client.listEarnEnabledVaults({
    organizationId,
  });
  const fresh: Target[] = [];
  for (const t of targets) {
    const v = (enabledVaults as EnabledVault[]).find(
      (e) => e.wrapperAddress?.toLowerCase() === t.wrapperAddress.toLowerCase(),
    );
    if (!v || v.depositsDisabled) continue;
    fresh.push({
      ...t,
      netApyPct: v.netApyPct ?? t.netApyPct,
      rewardsApyPct: v.rewardsApyPct,
      liquidity: v.liquidity,
    });
  }
  return fresh;
}

// rankVaults sorts targets by the yield this example collects (rewards
// excluded, since it doesn't claim them), best first, optionally on one chain.
const rankVaults = (targets: Target[], onlyChain?: string) =>
  targets
    .filter((t) => !onlyChain || t.caip2 === onlyChain)
    .sort((a, b) => (collectedApy(b) ?? 0) - (collectedApy(a) ?? 0));

export const bestVault = (targets: Target[], onlyChain?: string) =>
  rankVaults(targets, onlyChain)[0];

// ─── Policies ─────────────────────────────────────────────────────────────

const POLICY_PREFIX = "with-earn-delegated: ";

type PolicySpec = {
  policyName: string;
  effect: "EFFECT_ALLOW";
  consensus: string;
  condition: string;
  notes: string;
};

// EVM values are compared in lowercase and checksummed forms, since policies
// compare strings exactly. Solana addresses are case-sensitive and kept as is.
const isEvmValue = (value: string) =>
  value.startsWith("0x") || value.startsWith("eip155:");
const variants = (value: string) =>
  isEvmValue(value) ? [...new Set([value, value.toLowerCase()])] : [value];
const list = (values: string[]) =>
  `[${[...new Set(values.flatMap(variants))].map((v) => `'${v}'`).join(", ")}]`;
const evmAddrNoPrefix = (address: string) =>
  address.toLowerCase().replace(/^0x/, "");

// Pins a request to the Earn wallet's account. Swap quotes and Earn requests
// carry the signer as `sign_with`. An execute is bound to a quote, and the
// quote policies already pin its signer, so execute policies don't repeat it.
const signedBy = (address: string) =>
  `activity.params.sign_with in ${list([address])}`;

export function buildPolicies(
  customer: Customer,
  delegatedUserId: string,
  lists: AssetLists,
): PolicySpec[] {
  const consensus = `approvers.any(user, user.id == '${delegatedUserId}')`;
  const evmInputs = lists.inputs.filter((a) => !isSolana(a.caip19));
  const solInputs = lists.inputs.filter((a) => isSolana(a.caip19));
  const outputs = [
    ...lists.targets.map((t) => t.caip19),
    lists.returnAsset.caip19,
  ];
  const wrappers = lists.targets.map((t) => t.wrapperAddress.toLowerCase());
  const earnChains = [...new Set(lists.targets.map((t) => t.caip2))];
  const returnToken = lists.returnAsset.caip19.split(":").pop()!;
  const returnChainId = caip2Of(lists.returnAsset.caip19).split(":")[1];

  const p = (name: string, notes: string, ...parts: string[]): PolicySpec => ({
    policyName: `${POLICY_PREFIX}${name}`,
    effect: "EFFECT_ALLOW",
    consensus,
    condition: parts.join(" && "),
    notes,
  });
  const quote = `activity.kind == 'CREATE_SWAP_QUOTE'`;
  const execute = `activity.kind == 'EXECUTE_SWAP'`;
  const inputsIn = (assets: Asset[]) =>
    `activity.params.input_token in ${list(assets.map((a) => a.caip19))}`;
  const outputsIn = `activity.params.output_token in ${list(outputs)}`;
  const slippage = `activity.params.slippage_bps <= ${MAX_SLIPPAGE_BPS}`;
  const toEarnEvm = `activity.params.destination_address in ${list([customer.earnEvm])}`;
  // EVM swaps never name a destination: the output lands at the same address
  // on the output chain. A swap into a Solana token would have to name one, so
  // this keeps the EVM swaps from sending output anywhere else.
  const noDestination = `activity.params.destination_address == ''`;
  const wrappersIn = `activity.params.wrapper_address in ${list(wrappers)}`;
  const executeNote = "Lets the platform execute those quotes.";

  return [
    p(
      "return to deposit wallet",
      `Lets the platform send ${lists.returnAsset.symbol} on ${chainName(lists.returnAsset.caip2)} from the Earn wallet back to the customer's deposit wallet, and nowhere else.`,
      `eth.tx.from in ${list([customer.earnEvm])}`,
      `eth.tx.to == '${returnToken.toLowerCase()}'`,
      `eth.tx.data[0..10] == '0xa9059cbb'`,
      `eth.tx.data[34..74] == '${evmAddrNoPrefix(customer.depositEvm)}'`,
      `eth.tx.chain_id == ${returnChainId}`,
    ),
    p(
      "EVM swap quote",
      "Lets the platform quote stablecoin swaps from the Earn wallet into an enabled vault's asset or the return asset.",
      quote,
      inputsIn(evmInputs),
      outputsIn,
      noDestination,
      slippage,
      signedBy(customer.earnEvm),
    ),
    p(
      "EVM swap execute",
      executeNote,
      execute,
      inputsIn(evmInputs),
      outputsIn,
      noDestination,
    ),
    // Solana inputs are allowed only by policies that pin the destination to
    // the customer's own Earn EVM address. If the EVM swap policies accepted
    // Solana inputs, a Solana swap could send its output to any EVM address.
    ...(solInputs.length > 0
      ? [
          p(
            "Solana to EVM swap quote",
            "Lets the platform quote stablecoin swaps from the Earn wallet's Solana account to its own EVM address.",
            quote,
            inputsIn(solInputs),
            outputsIn,
            toEarnEvm,
            slippage,
            signedBy(customer.earnSol),
          ),
          p(
            "Solana to EVM swap execute",
            executeNote,
            execute,
            inputsIn(solInputs),
            outputsIn,
            toEarnEvm,
          ),
        ]
      : []),
    p(
      "Earn deposit",
      "Lets the platform deposit from the Earn wallet into the enabled vaults.",
      `activity.kind == 'EARN_DEPOSIT'`,
      wrappersIn,
      `activity.params.chain in ${list(earnChains)}`,
      signedBy(customer.earnEvm),
    ),
    p(
      "Earn withdraw",
      "Lets the platform withdraw the Earn wallet's positions back to the Earn wallet.",
      `activity.kind == 'EARN_WITHDRAW'`,
      wrappersIn,
      signedBy(customer.earnEvm),
    ),
  ];
}

// ─── Balances ─────────────────────────────────────────────────────────────

export type Holding = { asset: Asset; balance: v1AssetBalance; usd: number };

// holdings returns the wallet's balances of input assets on one chain. One
// balances call returns every asset on that chain.
export async function holdings(
  client: TurnkeyApiClient,
  organizationId: string,
  address: string,
  caip2: Caip2,
  inputs: Asset[],
): Promise<Holding[]> {
  const { balances = [] } = await client.getWalletAddressBalances({
    organizationId,
    address,
    caip2,
  });
  const result: Holding[] = [];
  for (const b of balances) {
    const asset = b.caip19
      ? inputs.find((a) => sameAsset(a.caip19, b.caip19!))
      : undefined;
    if (!asset || !b.balance || BigInt(b.balance) === 0n) continue;
    const display = Number(b.display?.usd);
    const usd =
      Number.isFinite(display) && display > 0
        ? display
        : Number(BigInt(b.balance)) / 10 ** asset.decimals; // stablecoins ≈ $1
    result.push({ asset, balance: b, usd });
  }
  return result;
}

// ─── Sending ──────────────────────────────────────────────────────────────

// sendEvm sends an ERC-20 transfer with gas sponsorship and waits for it.
export async function sendEvm(
  client: TurnkeyApiClient,
  organizationId: string,
  from: string,
  asset: Asset,
  to: string,
  amount: bigint,
): Promise<string | undefined> {
  const token = asset.caip19.split(":").pop() as `0x${string}`;
  const { sendTransactionStatusId } = await client.ethSendTransaction({
    organizationId,
    from,
    caip2: asset.caip2 as EthCaip2,
    sponsor: true,
    calls: [
      {
        to: token,
        value: "0",
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [to as `0x${string}`, amount],
        }),
      },
    ],
  });
  const status = await client.pollTransactionStatus({
    organizationId,
    sendTransactionStatusId,
    timeoutMs: 180_000,
  });
  return status.eth?.txHash;
}

// Solana program IDs used by the SPL transfer below.
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

// sendSolana sends an SPL token transfer with gas and rent sponsorship,
// creating the recipient's token account if it doesn't exist yet. The
// blockhash is a placeholder: Turnkey fetches a fresh one when sponsor=true.
//
// The two instructions are built directly with @solana/web3.js (they produce
// the same bytes as @solana/spl-token's helpers), so the demo doesn't need
// spl-token and its native add-on.
export async function sendSolana(
  client: TurnkeyApiClient,
  organizationId: string,
  from: string,
  asset: Asset,
  tokenProgram: string | undefined,
  to: string,
  amount: bigint,
): Promise<string | undefined> {
  // Loaded here, so scripts that never send on Solana don't load it.
  const {
    PublicKey,
    SystemProgram,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
  } = await import("@solana/web3.js");

  const programId = new PublicKey(
    tokenProgram === TOKEN_2022_PROGRAM ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM,
  );
  const ataProgram = new PublicKey(ASSOCIATED_TOKEN_PROGRAM);
  const mint = new PublicKey(asset.caip19.split(":").pop()!);
  const owner = new PublicKey(from);
  const recipient = new PublicKey(to);
  const tokenAccount = (wallet: InstanceType<typeof PublicKey>) =>
    PublicKey.findProgramAddressSync(
      [wallet.toBuffer(), programId.toBuffer(), mint.toBuffer()],
      ataProgram,
    )[0];
  const source = tokenAccount(owner);
  const destination = tokenAccount(recipient);

  // Associated Token Account program, CreateIdempotent (instruction 1): creates
  // the recipient's token account only if it doesn't exist.
  const createAccount = new TransactionInstruction({
    programId: ataProgram,
    data: Buffer.from([1]),
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: programId, isSigner: false, isWritable: false },
    ],
  });

  // Token program, TransferChecked (instruction 12): amount (u64) and decimals.
  const data = Buffer.alloc(10);
  data.writeUInt8(12, 0);
  data.writeBigUInt64LE(amount, 1);
  data.writeUInt8(asset.decimals, 9);
  const transfer = new TransactionInstruction({
    programId,
    data,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
  });

  const message = new TransactionMessage({
    payerKey: owner,
    recentBlockhash: "11111111111111111111111111111111",
    instructions: [createAccount, transfer],
  }).compileToV0Message();
  const unsignedTransaction = Buffer.from(
    new VersionedTransaction(message).serialize(),
  ).toString("hex");

  const { sendTransactionStatusId } = await client.solSendTransaction({
    organizationId,
    unsignedTransaction,
    signWiths: [from],
    caip2: asset.caip2 as SolCaip2,
    sponsor: true,
  });
  const status = await client.pollTransactionStatus({
    organizationId,
    sendTransactionStatusId,
    timeoutMs: 180_000,
  });
  return (status as { solana?: { signature?: string } }).solana?.signature;
}

// ─── Swapping ─────────────────────────────────────────────────────────────

type SwapStatus = Awaited<ReturnType<TurnkeyApiClient["getSwapStatus"]>>;

// pollSwapStatus polls get_swap_status until COMPLETED or FAILED. Adapted from
// examples/defi/with-swap: it waits up to SWAP_WAIT_MINUTES (cross-chain swaps
// stay PENDING until the other side settles) and returns "TIMEOUT" instead of
// throwing, because a slow swap isn't a failed one.
async function pollSwapStatus(
  client: TurnkeyApiClient,
  organizationId: string,
  swapRequestId: string,
): Promise<SwapStatus | "TIMEOUT"> {
  const deadline = Date.now() + SWAP_WAIT_MINUTES * 60_000;
  let last = "";
  while (Date.now() < deadline) {
    const status = await client.getSwapStatus({
      organizationId,
      swapRequestId,
    });
    if (status.status !== last) {
      console.log(
        `   swap ${status.status.toLowerCase()} (${status.swapKind})` +
          (status.originTxHash
            ? `  origin ${txLink(status.inputToken, status.originTxHash)}`
            : ""),
      );
      last = status.status;
    }
    if (status.status === "COMPLETED" || status.status === "FAILED") {
      return status;
    }
    await sleep(3_000);
  }
  return "TIMEOUT";
}

type SwapResult =
  | { kind: "completed"; outputAmount: bigint; status: SwapStatus }
  | { kind: "failed"; reason: string }
  | { kind: "pending" };

type SwapFeatures = { fixedRate?: boolean; feeSponsorship?: boolean };

// Errors meaning this swap can't use fixed rate or fee sponsorship right now.
const SWAP_FEATURE_ERROR =
  /SWAP_(FEATURE_NOT_ENABLED|FIXED_RATE_[A-Z_]+|SPENDING_LIMIT_EXCEEDED|SPONSORSHIP_BALANCE_INSUFFICIENT|FEE_SPONSORSHIP_UNAVAILABLE)/;

// swap quotes and executes one swap from the Earn wallet with gas sponsorship.
// Solana inputs send their output to the Earn wallet's EVM address. With
// FIXED_RATE or FEE_SPONSORSHIP on, a swap that can't use them is quoted again
// at the market rate without either.
export async function swap(
  client: TurnkeyApiClient,
  customer: Customer,
  from: Asset,
  to: Asset,
  amount: bigint,
  slippageBps: string,
): Promise<SwapResult> {
  const features: SwapFeatures = {
    ...(FIXED_RATE ? { fixedRate: true } : {}),
    ...(FEE_SPONSORSHIP ? { feeSponsorship: true } : {}),
  };
  if (Object.keys(features).length > 0) {
    try {
      return await quoteAndExecute(
        client,
        customer,
        from,
        to,
        amount,
        slippageBps,
        features,
      );
    } catch (error) {
      const code = errorMessage(error).match(SWAP_FEATURE_ERROR)?.[0];
      if (!code) throw error;
      console.log(
        `   ${code}: quoting again at the market rate, without fixed rate or fee sponsorship`,
      );
    }
  }
  return quoteAndExecute(client, customer, from, to, amount, slippageBps, {});
}

async function quoteAndExecute(
  client: TurnkeyApiClient,
  customer: Customer,
  from: Asset,
  to: Asset,
  amount: bigint,
  slippageBps: string,
  features: SwapFeatures,
): Promise<SwapResult> {
  const organizationId = customer.subOrgId;
  const fromSolana = isSolana(from.caip19);
  const signWith = fromSolana ? customer.earnSol : customer.earnEvm;
  const destination = fromSolana
    ? { destinationAddress: customer.earnEvm }
    : {};

  const { quotes = [] } = await client.createSwapQuote({
    organizationId,
    signWith,
    inputToken: from.caip19,
    outputToken: to.caip19,
    inputAmount: amount.toString(),
    slippageBps,
    ...destination,
    ...features,
  });
  const quote = quotes[0];
  if (!quote) return { kind: "failed", reason: "no swap quote returned" };
  const terms = [
    quote.fixedRate && "fixed rate",
    quote.feeSponsorship && "fees sponsored",
  ].filter(Boolean);
  console.log(
    `   quote ${quote.provider}: ${units(amount, from.decimals)} ${from.symbol} on ${chainName(from.caip2)} → ~${units(quote.outputAmount, to.decimals)} ${to.symbol} on ${chainName(to.caip2)} (min ${units(quote.minOutputAmount, to.decimals)}${terms.length ? `, ${terms.join(", ")}` : ""})`,
  );

  const { swapRequestId } = await client.executeSwap({
    organizationId,
    inputToken: from.caip19,
    inputAmount: amount.toString(),
    outputToken: to.caip19,
    sponsor: true,
    boundQuote: {
      quoteId: quote.quoteId,
      quotedOutputAmount: quote.outputAmount,
      minOutputAmount: quote.minOutputAmount,
    },
    ...destination,
  });

  const status = await pollSwapStatus(client, organizationId, swapRequestId);
  if (status === "TIMEOUT") return { kind: "pending" };
  if (status.status === "FAILED") {
    return {
      kind: "failed",
      reason: `${status.error?.reason ?? "FAILED"}: ${status.error?.message ?? "no detail"}${status.refund ? ` (refund ${status.refund.amount} of ${status.refund.asset})` : ""}`,
    };
  }
  return {
    kind: "completed",
    outputAmount: BigInt(status.outputAmount ?? quote.minOutputAmount),
    status,
  };
}

// ─── Policy denials ───────────────────────────────────────────────────────

// isPolicyDenial is true only for the policy engine's own denial, so a
// request that failed for another reason is never mistaken for one.
export function isPolicyDenial(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("PolicyEnginePermissionError") ||
    message.includes("No policies evaluated to outcome: Allow") ||
    /OUTCOME_DENY|OUTCOME_ERROR/.test(message)
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
