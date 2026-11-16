import type { Account } from "viem";
import {
  ASSET_CAIP19,
  CHAIN_CAIP2,
  IS_SOLANA,
  newClient,
  requireEnv,
  usdcToRaw,
} from "./common";
import { assetAddress, explorerLink, RPC_URL } from "./chain";

// One-off transfer from SIGN_WITH (demo org wallet) on CHAIN_CAIP2, e.g. to fund
// the end-user wallet from a faucet-funded one or to top up a paymaster.
// Usage: pnpm transfer <to-address> <amount> [usdc]
// Amount is the native token (ETH / SOL) by default; pass "usdc" as the third
// arg to send the catalog asset (ASSET_CAIP19) instead.
async function main() {
  const [to, amount, token] = process.argv.slice(2);
  if (!to || !amount) {
    throw new Error("usage: pnpm transfer <to-address> <amount> [usdc]");
  }
  if (!RPC_URL) {
    throw new Error(
      "no RPC endpoint for this chain; set EVM_RPC_URL or SOLANA_RPC_URL",
    );
  }

  const { client, organizationId } = newClient("TURNKEY");
  const signWith = requireEnv("SIGN_WITH");
  const sendToken = token?.toLowerCase() === "usdc";

  const hash = IS_SOLANA
    ? await transferSolana(
        client,
        organizationId,
        signWith,
        to,
        amount,
        sendToken,
      )
    : await transferEvm(
        client,
        organizationId,
        signWith,
        to,
        amount,
        sendToken,
      );

  console.log(`✅ ${explorerLink(hash)}`);
}

async function transferEvm(
  client: ReturnType<typeof newClient>["client"],
  organizationId: string,
  signWith: string,
  to: string,
  amount: string,
  sendToken: boolean,
): Promise<string> {
  const { createAccount } = await import("@turnkey/viem");
  const {
    createPublicClient,
    createWalletClient,
    defineChain,
    erc20Abi,
    http,
    parseEther,
  } = await import("viem");

  // The example's viem may be newer than @turnkey/viem's, so widen the account.
  const account = (await createAccount({
    client,
    organizationId,
    signWith,
  })) as Account;
  const transport = http(RPC_URL);
  const publicClient = createPublicClient({ transport });
  const chain = defineChain({
    id: await publicClient.getChainId(),
    name: CHAIN_CAIP2,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL!] } },
  });
  const walletClient = createWalletClient({ account, chain, transport });

  let hash: `0x${string}`;
  if (sendToken) {
    console.log(`Sending ${amount} USDC from ${signWith} to ${to}…`);
    hash = await walletClient.writeContract({
      account,
      chain,
      address: assetAddress(ASSET_CAIP19) as `0x${string}`,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to as `0x${string}`, BigInt(usdcToRaw(amount))],
    });
  } else {
    console.log(`Sending ${amount} ETH from ${signWith} to ${to}…`);
    hash = await walletClient.sendTransaction({
      account,
      chain,
      to: to as `0x${string}`,
      value: parseEther(amount),
    });
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`   ${receipt.status} in block ${receipt.blockNumber}`);

  return hash;
}

async function transferSolana(
  client: ReturnType<typeof newClient>["client"],
  organizationId: string,
  signWith: string,
  to: string,
  amount: string,
  sendToken: boolean,
): Promise<string> {
  const { TurnkeySigner } = await import("@turnkey/solana");
  const {
    Connection,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
  } = await import("@solana/web3.js");
  const {
    createAssociatedTokenAccountIdempotentInstruction,
    createTransferCheckedInstruction,
    getAssociatedTokenAddressSync,
  } = await import("@solana/spl-token");

  const connection = new Connection(RPC_URL!, "confirmed");
  const signer = new TurnkeySigner({ organizationId, client });
  const from = new PublicKey(signWith);
  const recipient = new PublicKey(to);

  const tx = new Transaction();
  if (sendToken) {
    const mint = new PublicKey(assetAddress(ASSET_CAIP19));
    const source = getAssociatedTokenAddressSync(mint, from);
    const destination = getAssociatedTokenAddressSync(mint, recipient);

    console.log(`Sending ${amount} USDC from ${signWith} to ${to}…`);
    tx.add(
      // The sender pays the recipient's token-account rent if it doesn't exist.
      createAssociatedTokenAccountIdempotentInstruction(
        from,
        destination,
        recipient,
        mint,
      ),
      createTransferCheckedInstruction(
        source,
        mint,
        destination,
        from,
        BigInt(usdcToRaw(amount)),
        6,
      ),
    );
  } else {
    console.log(`Sending ${amount} SOL from ${signWith} to ${to}…`);
    tx.add(
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: recipient,
        lamports: BigInt(Math.round(Number(amount) * LAMPORTS_PER_SOL)),
      }),
    );
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = from;

  const signed = await signer.signTransaction(tx, signWith);
  const signature = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  return signature;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
