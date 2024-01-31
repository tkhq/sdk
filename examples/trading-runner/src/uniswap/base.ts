import type { TurnkeySigner } from "@turnkey/ethers";
import { Currency, CurrencyAmount, Token, TradeType } from "@uniswap/sdk-core";
import {
  Pool,
  Route,
  SwapOptions,
  SwapQuoter,
  SwapRouter,
  Trade,
} from "@uniswap/v3-sdk";
import { ethers } from "ethers";
import JSBI from "jsbi";

import { getV3PoolInfo } from "./pool";
import { print } from "../utils";
import {
  DEFAULT_SLIPPAGE_TOLERANCE,
  DEFAULT_MAX_PRIORITY_FEE_PER_GAS,
  DEFAULT_MAX_FEE_PER_GAS,
  GAS_MULTIPLIER,
  ERC20_ABI,
  FEE_AMOUNT,
  QUOTER_CONTRACT_ADDRESS,
  SWAP_ROUTER_ADDRESS,
} from "./constants";

export type TokenTrade = Trade<Token, Token, TradeType>;

// Trading Functions

export async function prepareV3Trade(
  connectedSigner: TurnkeySigner,
  inputToken: Token,
  outputToken: Token,
  inputAmount: bigint
): Promise<TokenTrade> {
  const address = await connectedSigner.getAddress();

  const tokenContract = new ethers.Contract(
    inputToken.address,
    ERC20_ABI,
    connectedSigner
  );

  const tokenBalance = await tokenContract.balanceOf?.(address);
  if (tokenBalance < inputAmount) {
    throw new Error(
      `Insufficient funds to perform this trade. Have: ${tokenBalance} ${inputToken.symbol}; Need: ${inputAmount} ${inputToken.symbol}.`
    );
  }

  const poolInfo = await getV3PoolInfo(
    connectedSigner.provider!,
    inputToken,
    outputToken
  );

  const pool = new Pool(
    inputToken,
    outputToken,
    FEE_AMOUNT,
    poolInfo.sqrtPriceX96.toString(),
    poolInfo.liquidity.toString(),
    poolInfo.tick
  );

  const swapRoute = new Route([pool], inputToken, outputToken);

  const amountOut = await getOutputQuote(
    connectedSigner,
    swapRoute,
    inputToken,
    inputAmount
  );

  const uncheckedTrade = Trade.createUncheckedTrade({
    route: swapRoute,
    inputAmount: CurrencyAmount.fromRawAmount(
      inputToken,
      inputAmount.toString()
    ),
    outputAmount: CurrencyAmount.fromRawAmount(
      outputToken,
      JSBI.BigInt(amountOut)
    ),
    tradeType: TradeType.EXACT_INPUT,
  });

  return uncheckedTrade;
}

export async function executeTrade(
  connectedSigner: TurnkeySigner,
  trade: TokenTrade,
  inputToken: Token,
  inputAmount: bigint
): Promise<ethers.TransactionReceipt | null> {
  const provider = connectedSigner.provider!;
  const address = await connectedSigner.getAddress();

  if (!address || !provider) {
    throw new Error("Cannot execute a trade without a connected wallet");
  }

  // Give approval to the router to spend the token
  // TODO: Realistically, we should only do this if necessary (to prevent unnecessary contract calls)
  await getTokenTransferApproval(connectedSigner, inputToken, inputAmount);

  const options: SwapOptions = {
    slippageTolerance: DEFAULT_SLIPPAGE_TOLERANCE,
    deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from the current Unix time
    recipient: address,
  };

  const methodParameters = SwapRouter.swapCallParameters([trade], options);

  const feeData = await provider.getFeeData();

  const tx = {
    data: methodParameters.calldata,
    to: SWAP_ROUTER_ADDRESS,
    value: methodParameters.value,
    from: address,
    maxFeePerGas: feeData?.maxFeePerGas
      ? feeData?.maxFeePerGas * GAS_MULTIPLIER
      : DEFAULT_MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas
      ? feeData?.maxPriorityFeePerGas * GAS_MULTIPLIER
      : DEFAULT_MAX_PRIORITY_FEE_PER_GAS,
  };

  const swapTx = await connectedSigner.sendTransaction(tx);

  console.log("Awaiting confirmation for swap tx...\n");

  const result = await connectedSigner.provider!.waitForTransaction(
    swapTx.hash,
    1
  );

  print(`Swap successful:`, `https://goerli.etherscan.io/tx/${swapTx.hash}`);

  return result;
}

// Helper Quoting and Pool Functions

async function getOutputQuote(
  connectedSigner: TurnkeySigner,
  route: Route<Currency, Currency>,
  inputToken: Token,
  inputAmount: bigint
) {
  const provider = connectedSigner.provider!;

  if (!provider) {
    throw new Error("Provider required to get pool state");
  }

  const { calldata } = await SwapQuoter.quoteCallParameters(
    route,
    CurrencyAmount.fromRawAmount(inputToken, inputAmount.toString()), // TODO: verify this amount
    TradeType.EXACT_INPUT,
    {
      useQuoterV2: true,
    }
  );

  const quoteCallReturnData = await provider.call({
    to: QUOTER_CONTRACT_ADDRESS,
    data: calldata,
  });

  return ethers.AbiCoder.defaultAbiCoder().decode(
    ["uint256"],
    quoteCallReturnData
  );
}

export async function getTokenTransferApproval(
  connectedSigner: TurnkeySigner,
  token: Token,
  amount: bigint
): Promise<boolean> {
  const address = await connectedSigner.getAddress();
  if (!connectedSigner || !address) {
    console.error("No Connected Signer Found");
    return false;
  }

  try {
    const tokenContract = new ethers.Contract(
      token.address,
      ERC20_ABI,
      connectedSigner
    );

    // Verify that `approve` is an available method on the contract
    if (!tokenContract.approve?.populateTransaction) return false;

    const transaction = await tokenContract.approve?.populateTransaction(
      SWAP_ROUTER_ADDRESS,
      amount.toString() // double check this
    );

    let approveTx = await connectedSigner.sendTransaction({
      ...transaction,
      from: address,
    });

    console.log("Awaiting confirmation for approve tx...\n");

    await connectedSigner.provider!.waitForTransaction(approveTx.hash, 1);

    print(
      "Token spending approved:",
      `https://goerli.etherscan.io/tx/${approveTx.hash}`
    );

    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}
