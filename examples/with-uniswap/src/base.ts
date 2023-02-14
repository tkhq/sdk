import {
  Currency,
  CurrencyAmount,
  Percent,
  Token,
  TradeType,
} from "@uniswap/sdk-core";
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
import { fromReadableAmount, TransactionState } from "./abi/utils";
import {
  getProvider,
  getTurnkeySigner,
  getTurnkeyWalletAddress,
} from "./provider";
import {
  DEFAULT_MAX_PRIORITY_FEE_PER_GAS,
  DEFAULT_MAX_FEE_PER_GAS,
  DEFAULT_TOKEN_APPROVAL_AMOUNT,
  ERC20_ABI,
  QUOTER_CONTRACT_ADDRESS,
  SWAP_ROUTER_ADDRESS,
} from "./constants";
import { UniV3SwapConfig } from "./config";

export type TokenTrade = Trade<Token, Token, TradeType>;

export type UniV3TradeParams = {
  tokenIn: Token;
  tokenOut: Token;
  fee: Number;
};

// Trading Functions

export async function createV3Trade(): Promise<TokenTrade> {
  const poolInfo = await getV3PoolInfo();

  const pool = new Pool(
    UniV3SwapConfig.tokens.in,
    UniV3SwapConfig.tokens.out,
    UniV3SwapConfig.tokens.poolFee,
    poolInfo.sqrtPriceX96.toString(),
    poolInfo.liquidity.toString(),
    poolInfo.tick
  );

  const swapRoute = new Route(
    [pool],
    UniV3SwapConfig.tokens.in,
    UniV3SwapConfig.tokens.out
  );

  const amountOut = await getOutputQuote(swapRoute);

  const uncheckedTrade = Trade.createUncheckedTrade({
    route: swapRoute,
    inputAmount: CurrencyAmount.fromRawAmount(
      UniV3SwapConfig.tokens.in,
      fromReadableAmount(
        UniV3SwapConfig.tokens.amountIn,
        UniV3SwapConfig.tokens.in.decimals
      ).toString()
    ),
    outputAmount: CurrencyAmount.fromRawAmount(
      UniV3SwapConfig.tokens.out,
      JSBI.BigInt(amountOut)
    ),
    tradeType: TradeType.EXACT_INPUT,
  });

  return uncheckedTrade;
}

export async function executeTrade(
  trade: TokenTrade
): Promise<ethers.providers.TransactionResponse> {
  const walletAddress = getTurnkeyWalletAddress();
  const provider = getProvider();
  const connectedSigner = getTurnkeySigner();

  if (!walletAddress || !provider) {
    throw new Error("Cannot execute a trade without a connected wallet");
  }

  // Give approval to the router to spend the token
  // TODO: Realistically, we should only do this if necessary (to prevent unnecessary contract calls)
  const tokenApproval = await getTokenTransferApproval(
    UniV3SwapConfig.tokens.in
  );

  // Fail if transfer approvals do not go through
  if (tokenApproval !== TransactionState.Sent) {
    throw new Error("Unable to approve transfer");
  }

  console.log(`Token approval: ${JSON.stringify(tokenApproval)}`);

  const options: SwapOptions = {
    slippageTolerance: new Percent(50, 10_000), // 50 bips, or 0.50%
    deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from the current Unix time
    recipient: walletAddress, // NOTE: interesting that one might be able to configure this
  };

  const methodParameters = SwapRouter.swapCallParameters([trade], options);

  console.log(`Swap method parameters: ${JSON.stringify(methodParameters)}`);

  const tx = {
    data: methodParameters.calldata,
    to: SWAP_ROUTER_ADDRESS,
    value: methodParameters.value,
    from: walletAddress,
    maxFeePerGas: DEFAULT_MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: DEFAULT_MAX_PRIORITY_FEE_PER_GAS,
  };

  return await connectedSigner.sendTransaction(tx);
}

// Helper Quoting and Pool Functions

async function getOutputQuote(route: Route<Currency, Currency>) {
  const provider = getProvider();

  if (!provider) {
    throw new Error("Provider required to get pool state");
  }

  const { calldata } = await SwapQuoter.quoteCallParameters(
    route,
    CurrencyAmount.fromRawAmount(
      UniV3SwapConfig.tokens.in,
      fromReadableAmount(
        UniV3SwapConfig.tokens.amountIn,
        UniV3SwapConfig.tokens.in.decimals
      ).toString()
    ),
    TradeType.EXACT_INPUT,
    {
      useQuoterV2: true,
    }
  );

  const quoteCallReturnData = await provider.call({
    to: QUOTER_CONTRACT_ADDRESS,
    data: calldata,
  });

  return ethers.utils.defaultAbiCoder.decode(["uint256"], quoteCallReturnData);
}

export async function getTokenTransferApproval(
  token: Token
): Promise<TransactionState> {
  const connectedSigner = getTurnkeySigner();
  const address = getTurnkeyWalletAddress();
  if (!connectedSigner || !address) {
    console.log("No Connected Signer Found");
    return TransactionState.Failed;
  }

  try {
    const tokenContract = new ethers.Contract(
      token.address,
      ERC20_ABI,
      connectedSigner
    );

    // Verify that `approve` is an available method on the contract
    if (!tokenContract.populateTransaction.approve)
      return TransactionState.Failed;

    const transaction = await tokenContract.populateTransaction.approve(
      // const transaction = await tokenContract.approve(
      SWAP_ROUTER_ADDRESS,
      fromReadableAmount(
        DEFAULT_TOKEN_APPROVAL_AMOUNT, // ideally, use a static amount like `UniV3SwapConfig.tokens.amountIn`
        token.decimals
      ).toString()
    );

    let response = await connectedSigner.sendTransaction({
      ...transaction,
      from: address,
    });

    if (response) {
      return TransactionState.Sent;
    } else {
      return TransactionState.Failed;
    }
  } catch (e) {
    console.error(e);
    return TransactionState.Failed;
  }
}
