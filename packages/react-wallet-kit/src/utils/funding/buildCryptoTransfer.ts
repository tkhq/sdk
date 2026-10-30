import {
  TurnkeyError,
  TurnkeyErrorCodes,
  type OnRampCaip19,
  type OnRampCaip2,
  type WalletAccount,
} from "@turnkey/core";
import { encodeFunctionData, type Hex } from "viem";
import { assetOf, caip2Of } from "./tokenSymbol";

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

type TransferBase = {
  from: string;
  to: string;
  caip2: OnRampCaip2;
  caip19: OnRampCaip19;
  /** Base-unit integer string. */
  amount: string;
};

export type OnRampCryptoTransfer =
  | (TransferBase & {
      kind: "native";
      transactionType: "TRANSACTION_TYPE_ETHEREUM" | "TRANSACTION_TYPE_SOLANA";
    })
  | (TransferBase & {
      kind: "erc20";
      transactionType: "TRANSACTION_TYPE_ETHEREUM";
      tokenAddress: Hex;
      data: Hex;
    })
  | (TransferBase & {
      kind: "spl";
      transactionType: "TRANSACTION_TYPE_SOLANA";
      mintAddress: string;
    });

export function buildOnRampCryptoTransfer(params: {
  token: OnRampCaip19;
  amount: string;
  decimals: number;
  from: WalletAccount;
  to: WalletAccount;
}): OnRampCryptoTransfer {
  const { token, amount, decimals, from, to } = params;
  const atomic = toAtomicAmount(amount, decimals);
  if (atomic === undefined || atomic <= 0n) {
    throw new TurnkeyError(
      "Enter an amount greater than 0.",
      TurnkeyErrorCodes.INVALID_REQUEST,
    );
  }
  if (!from.address || !to.address) {
    throw new TurnkeyError(
      "A source and destination address are required.",
      TurnkeyErrorCodes.INVALID_REQUEST,
    );
  }

  const chain = chainOf(token);
  if (chainOfAccount(from) !== chain || chainOfAccount(to) !== chain) {
    throw new TurnkeyError(
      "The external wallet and destination must be on the same chain as the token.",
      TurnkeyErrorCodes.INVALID_REQUEST,
    );
  }

  return transferFromAsset({
    caip2: caip2Of(token),
    asset: assetOf(token),
    quotedToken: token,
    from: from.address,
    to: to.address,
    atomicAmount: atomic.toString(),
  });
}

// The sent asset can differ from the quoted token. Sandbox offramp rewrites both.
export function transferFromAsset(params: {
  caip2: string;
  asset: string;
  quotedToken: OnRampCaip19;
  from: string;
  to: string;
  atomicAmount: string;
}): OnRampCryptoTransfer {
  const { caip2, asset, quotedToken, from, to, atomicAmount } = params;
  const base = {
    from,
    to,
    caip2: caip2 as OnRampCaip2,
    caip19: quotedToken,
    amount: atomicAmount,
  };

  if (caip2.startsWith("solana:")) {
    if (asset.startsWith("token:")) {
      return {
        ...base,
        kind: "spl",
        transactionType: "TRANSACTION_TYPE_SOLANA",
        mintAddress: asset.slice("token:".length),
      };
    }
    if (asset !== "slip44:501") {
      throw new TurnkeyError(
        "This token cannot be transferred.",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }
    return {
      ...base,
      kind: "native",
      transactionType: "TRANSACTION_TYPE_SOLANA",
    };
  }

  if (asset.startsWith("erc20:")) {
    return {
      ...base,
      kind: "erc20",
      transactionType: "TRANSACTION_TYPE_ETHEREUM",
      tokenAddress: asset.slice("erc20:".length) as Hex,
      data: encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [to as Hex, BigInt(atomicAmount)],
      }),
    };
  }

  if (asset !== "slip44:60") {
    throw new TurnkeyError(
      "This token cannot be transferred.",
      TurnkeyErrorCodes.INVALID_REQUEST,
    );
  }

  return {
    ...base,
    kind: "native",
    transactionType: "TRANSACTION_TYPE_ETHEREUM",
  };
}

export function toAtomicAmount(
  value: string,
  decimals: number,
): bigint | undefined {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined;

  const [whole = "0", fraction = ""] = trimmed.split(".");
  const digits = `${fraction}${"0".repeat(decimals)}`.slice(0, decimals);

  try {
    return BigInt(`${whole || "0"}${digits}`);
  } catch {
    return undefined;
  }
}

function chainOf(token: OnRampCaip19): "ethereum" | "solana" {
  const caip2 = caip2Of(token);
  if (caip2.startsWith("eip155:")) return "ethereum";
  if (caip2.startsWith("solana:")) return "solana";
  throw new TurnkeyError(
    "This token cannot be transferred.",
    TurnkeyErrorCodes.INVALID_REQUEST,
  );
}

function chainOfAccount(
  account: WalletAccount,
): "ethereum" | "solana" | undefined {
  if (account.addressFormat === "ADDRESS_FORMAT_ETHEREUM") return "ethereum";
  if (account.addressFormat === "ADDRESS_FORMAT_SOLANA") return "solana";
  return undefined;
}
