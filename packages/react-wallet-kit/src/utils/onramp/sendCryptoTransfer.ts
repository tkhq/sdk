import { getTransferSolInstruction } from "@solana-program/system";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstruction,
  getTransferInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { atob, uint8ArrayToHexString } from "@turnkey/encoding";
import {
  Chain,
  TurnkeyError,
  TurnkeyErrorCodes,
  type WalletProvider,
  type WalletRpcProvider,
} from "@turnkey/core";
import { numberToHex, serializeTransaction, type Hex } from "viem";
import type { OnRampCryptoTransfer } from "./buildCryptoTransfer";

export async function buildUnsignedOnRampTransaction(params: {
  transfer: OnRampCryptoTransfer;
  provider: WalletRpcProvider;
  rpcUrl?: string | undefined;
}): Promise<string> {
  const { transfer, provider, rpcUrl } = params;
  if (transfer.transactionType === "TRANSACTION_TYPE_SOLANA") {
    if (!rpcUrl) {
      throw new TurnkeyError(
        "Missing rpcUrl: connected Solana wallets require an RPC URL to broadcast transactions.",
        TurnkeyErrorCodes.SIGN_AND_SEND_TRANSACTION_ERROR,
      );
    }
    return buildUnsignedSolanaTransaction(transfer, rpcUrl);
  }
  return buildUnsignedEthereumTransaction(transfer, provider);
}

export function isUserRejected(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (record.code === 4001 || record.code === "ACTION_REJECTED") return true;
    if (
      typeof record.message === "string" &&
      /user rejected|user denied|rejected the request/i.test(record.message)
    ) {
      return true;
    }
    current = record.cause;
  }
  return false;
}

export function evmChainId(chainInfo: WalletProvider["chainInfo"]) {
  if (chainInfo.namespace !== Chain.Ethereum || !("chainId" in chainInfo)) {
    return undefined;
  }
  const chainId = chainInfo.chainId;
  if (typeof chainId !== "string") return undefined;
  return chainId.startsWith("0x")
    ? Number.parseInt(chainId, 16)
    : Number(chainId);
}

async function buildUnsignedEthereumTransaction(
  transfer: OnRampCryptoTransfer,
  provider: WalletRpcProvider,
) {
  const chainId = Number(transfer.caip2.slice("eip155:".length));
  const to = (
    transfer.kind === "erc20" ? transfer.tokenAddress : transfer.to
  ) as Hex;
  const value = transfer.kind === "native" ? BigInt(transfer.amount) : 0n;
  const data = transfer.kind === "erc20" ? transfer.data : "0x";
  const request = {
    from: transfer.from,
    to,
    value: numberToHex(value),
    data,
  };

  const [nonceHex, gasHex] = await Promise.all([
    evmRequest(provider, "eth_getTransactionCount", [transfer.from, "pending"]),
    evmRequest(provider, "eth_estimateGas", [request]),
  ]);
  const nonce = Number(BigInt(String(nonceHex)));
  const gas = (BigInt(String(gasHex)) * 12n) / 10n;

  try {
    const [priorityHex, block] = await Promise.all([
      evmRequest(provider, "eth_maxPriorityFeePerGas"),
      evmRequest(provider, "eth_getBlockByNumber", ["latest", false]),
    ]);
    const baseFeePerGas = (block as { baseFeePerGas?: string } | null)
      ?.baseFeePerGas;
    if (!baseFeePerGas) throw new Error("Missing base fee");
    const maxPriorityFeePerGas = BigInt(String(priorityHex));
    const maxFeePerGas = BigInt(baseFeePerGas) * 2n + maxPriorityFeePerGas;
    return serializeTransaction({
      type: "eip1559",
      chainId,
      nonce,
      gas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      to,
      value,
      data,
    });
  } catch (error) {
    if (isUserRejected(error)) throw error;
    const gasPrice = BigInt(String(await evmRequest(provider, "eth_gasPrice")));
    return serializeTransaction({
      type: "legacy",
      chainId,
      nonce,
      gas,
      gasPrice,
      to,
      value,
      data,
    });
  }
}

export async function buildUnsignedSolanaTransaction(
  transfer: OnRampCryptoTransfer,
  rpcUrl: string,
) {
  const rpc = createSolanaRpc(rpcUrl);
  const from = address(transfer.from);
  const to = address(transfer.to);
  const payer = createNoopSigner(from);
  const instructions: SolanaInstruction[] = [];

  if (transfer.kind === "spl") {
    const mint = address(transfer.mintAddress);
    const mintAccount = await rpc
      .getAccountInfo(mint, { encoding: "base64" })
      .send();
    if (!mintAccount.value) {
      throw new TurnkeyError(
        "Token mint was not found.",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }
    const tokenProgram = mintAccount.value.owner ?? TOKEN_PROGRAM_ADDRESS;
    const [fromTokenAccount] = await findAssociatedTokenPda({
      owner: from,
      tokenProgram,
      mint,
    });
    const [toTokenAccount] = await findAssociatedTokenPda({
      owner: to,
      tokenProgram,
      mint,
    });
    const destination = await rpc
      .getAccountInfo(toTokenAccount, { encoding: "base64" })
      .send();
    if (!destination.value) {
      instructions.push(
        getCreateAssociatedTokenInstruction({
          payer,
          ata: toTokenAccount,
          owner: to,
          mint,
          tokenProgram,
        }),
      );
    }
    instructions.push(
      getTransferInstruction(
        {
          source: fromTokenAccount,
          destination: toTokenAccount,
          authority: payer,
          amount: BigInt(transfer.amount),
        },
        { programAddress: tokenProgram },
      ),
    );
  } else {
    instructions.push(
      getTransferSolInstruction({
        source: payer,
        destination: to,
        amount: BigInt(transfer.amount),
      }),
    );
  }

  // sendTransaction simulates at "finalized" unless told otherwise. A "confirmed"
  // blockhash is not in that cache yet, so the RPC rejects it as BlockhashNotFound.
  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash({ commitment: "finalized" })
    .send();
  const transaction = compileTransaction(
    setTransactionMessageLifetimeUsingBlockhash(
      latestBlockhash,
      appendTransactionMessageInstructions(
        instructions,
        setTransactionMessageFeePayer(
          from,
          createTransactionMessage({ version: "legacy" }),
        ),
      ),
    ),
  );
  const binary = atob(getBase64EncodedWireTransaction(transaction));
  return uint8ArrayToHexString(
    Uint8Array.from(binary, (char) => char.charCodeAt(0)),
  );
}

type SolanaInstruction = Parameters<
  typeof appendTransactionMessageInstructions
>[0][number];

export function switchSelectedEthereumChain(
  provider: WalletRpcProvider,
  hexChainId: string,
) {
  return evmRequest(provider, "wallet_switchEthereumChain", [
    { chainId: hexChainId },
  ]);
}

function evmRequest(
  provider: WalletRpcProvider,
  method: string,
  params?: unknown[],
) {
  const request = (provider as { request?: unknown }).request;
  if (typeof request !== "function") {
    throw new TurnkeyError(
      "This wallet cannot send Ethereum transactions.",
      TurnkeyErrorCodes.INVALID_REQUEST,
    );
  }
  return (
    request as (args: {
      method: string;
      params?: unknown[];
    }) => Promise<unknown>
  ).call(provider, {
    method,
    ...(params ? { params } : {}),
  });
}
