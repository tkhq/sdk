import IUniswapV3PoolABI from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";
import { computePoolAddress } from "@uniswap/v3-sdk";
import type { Token } from "@uniswap/sdk-core";
import { ethers } from "ethers";

import { FEE_AMOUNT } from "./constants";
import { POOL_FACTORY_CONTRACT_ADDRESS } from "./constants";

interface PoolInfo {
  token0: string;
  token1: string;
  fee: number;
  tickSpacing: number;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tick: number;
}

export async function getV3PoolInfo(
  provider: ethers.Provider,
  inputToken: Token,
  outputToken: Token
): Promise<PoolInfo> {
  const currentPoolAddress = computePoolAddress({
    factoryAddress: POOL_FACTORY_CONTRACT_ADDRESS,
    tokenA: inputToken,
    tokenB: outputToken,
    fee: FEE_AMOUNT,
  });

  const poolContract = new ethers.Contract(
    currentPoolAddress,
    IUniswapV3PoolABI.abi,
    provider
  );

  const [token0, token1, fee, tickSpacing, liquidity, slot0] =
    await Promise.all([
      poolContract.token0?.(),
      poolContract.token1?.(),
      poolContract.fee?.(),
      poolContract.tickSpacing?.(),
      poolContract.liquidity?.(),
      poolContract.slot0?.(),
    ]);

  return {
    token0,
    token1,
    fee,
    tickSpacing,
    liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
  };
}
