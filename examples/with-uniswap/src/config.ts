import type { Token } from "@uniswap/sdk-core";
import { FeeAmount } from "@uniswap/v3-sdk";
import { Environment, UNI_TOKEN_GOERLI, WETH_TOKEN_GOERLI } from "./constants";

export interface BaseConfig {
  env: Environment;
  tokens: {
    in: Token; // input token - what you're trading away
    amountIn: number; // whole amount
    out: Token; // output token - what you're acquiring
    poolFee: number;
  };
}

// Support multiple configs (for usage with various scripts)

// Trading instructions for use with `univ3-swap.ts`:
export const UniV3SwapConfig: BaseConfig = {
  env: Environment.GOERLI,
  tokens: {
    in: UNI_TOKEN_GOERLI,
    amountIn: 0.011,
    out: WETH_TOKEN_GOERLI,
    poolFee: FeeAmount.MEDIUM,
  },
};
