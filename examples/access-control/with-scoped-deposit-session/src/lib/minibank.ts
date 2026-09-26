/**
 * Read-only chain access and calldata builders for the browser app.
 *
 * Reads go straight to a public Base Sepolia RPC. Writes never touch an RPC:
 * Turnkey constructs, signs, broadcasts and pays for them through
 * `ethSendTransaction` with `sponsor: true`. These helpers only encode the
 * `calls` that request carries.
 */
import {
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  http,
  parseUnits,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  ERC20_ABI,
  MINIBANK_ABI,
  MINIBANK_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
} from "./config";

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

/** One entry of an ETH_SEND_TRANSACTION_V2 `calls` array. */
export type Call = { to: Hex; data: Hex; value?: string };

export type Balances = {
  /** USDC held by the wallet. */
  wallet: bigint;
  /** USDC the wallet has deposited into MiniBank. */
  bank: bigint;
  /** USDC MiniBank is currently allowed to pull from the wallet. */
  allowance: bigint;
};

export async function readBalances(account: Hex): Promise<Balances> {
  const [wallet, bank, allowance] = await Promise.all([
    publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account],
    }),
    publicClient.readContract({
      address: MINIBANK_ADDRESS,
      abi: MINIBANK_ABI,
      functionName: "balanceOf",
      args: [account],
    }),
    publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account, MINIBANK_ADDRESS],
    }),
  ]);
  return { wallet, bank, allowance };
}

export const toUsdc = (human: string): bigint =>
  parseUnits(human.trim() || "0", USDC_DECIMALS);
export const fmtUsdc = (units: bigint): string =>
  formatUnits(units, USDC_DECIMALS);

/** USDC.approve(spender, amount). Allowed by the scope when spender is MiniBank. */
export function approveCall(spender: Hex, amount: bigint): Call {
  return {
    to: USDC_ADDRESS,
    data: encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, amount],
    }),
  };
}

/** MiniBank.deposit(amount). Allowed by the scope. */
export function depositCall(amount: bigint): Call {
  return {
    to: MINIBANK_ADDRESS,
    data: encodeFunctionData({
      abi: MINIBANK_ABI,
      functionName: "deposit",
      args: [amount],
    }),
  };
}

/** MiniBank.withdraw(amount). Right contract, wrong selector: denied. */
export function withdrawCall(amount: bigint): Call {
  return {
    to: MINIBANK_ADDRESS,
    data: encodeFunctionData({
      abi: MINIBANK_ABI,
      functionName: "withdraw",
      args: [amount],
    }),
  };
}

/** USDC.transfer(to, amount). Right contract for the approve branch, wrong selector: denied. */
export function transferCall(to: Hex, amount: bigint): Call {
  return {
    to: USDC_ADDRESS,
    data: encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [to, amount],
    }),
  };
}

/**
 * Four bytes that match no allowed selector. Refused. Ten characters of
 * calldata, so the scope's `data[34..74]` slice also runs past the end and
 * the refusal arrives as an evaluation error rather than a denial.
 */
export function unrecognizedCall(): Call {
  return { to: USDC_ADDRESS, data: "0xdeadbeef" };
}
