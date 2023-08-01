import type { TurnkeySigner } from "@turnkey/ethers";
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
import { TransactionState } from "./utils";
// import { fromReadableAmount, TransactionState } from "./utils";
import { getProvider, getTurnkeySigner } from "./provider";
import {
  DEFAULT_MAX_PRIORITY_FEE_PER_GAS,
  DEFAULT_MAX_FEE_PER_GAS,
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
  inputAmount: ethers.BigNumber
): Promise<TokenTrade> {
  const address = await connectedSigner.getAddress();

  const tokenContract = new ethers.Contract(
    inputToken.address,
    ERC20_ABI,
    connectedSigner
  );

  const tokenBalance = await tokenContract.balanceOf(address);
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

  const amountOut = await getOutputQuote(swapRoute, inputToken, inputAmount);

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
  inputAmount: ethers.BigNumber
): Promise<ethers.providers.TransactionResponse> {
  const provider = connectedSigner.provider!;
  const address = await connectedSigner.getAddress();

  if (!address || !provider) {
    throw new Error("Cannot execute a trade without a connected wallet");
  }

  // Give approval to the router to spend the token
  // TODO: Realistically, we should only do this if necessary (to prevent unnecessary contract calls)
  const tokenApproval = await getTokenTransferApproval(inputToken, inputAmount);

  // Fail if transfer approvals do not go through
  if (tokenApproval !== TransactionState.Sent) {
    throw new Error("Unable to approve transfer");
  }

  console.log(`Token approval: ${JSON.stringify(tokenApproval)}`);

  const options: SwapOptions = {
    slippageTolerance: new Percent(50, 10_000), // 50 bips, or 0.50%
    deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from the current Unix time
    recipient: address, // specifying a recipient is neat
  };

  const methodParameters = SwapRouter.swapCallParameters([trade], options);

  console.log(`Swap method parameters: ${JSON.stringify(methodParameters)}`);

  const feeData = await provider.getFeeData();

  const tx = {
    data: methodParameters.calldata,
    to: SWAP_ROUTER_ADDRESS,
    value: methodParameters.value,
    from: address,
    // the following gas-related fields can be omitted, in which case Ethers will automatically populate them
    maxFeePerGas: feeData.maxFeePerGas || DEFAULT_MAX_FEE_PER_GAS,
    maxPriorityFeePerGas:
      feeData.maxPriorityFeePerGas || DEFAULT_MAX_PRIORITY_FEE_PER_GAS,
  };

  return await connectedSigner.sendTransaction(tx);
}

// Helper Quoting and Pool Functions

async function getOutputQuote(
  route: Route<Currency, Currency>,
  inputToken: Token,
  inputAmount: ethers.BigNumber,
) {
  const provider = getProvider();

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

  return ethers.utils.defaultAbiCoder.decode(["uint256"], quoteCallReturnData);
}

export async function getTokenTransferApproval(
  token: Token,
  amount: ethers.BigNumber
): Promise<TransactionState> {
  const provider = getProvider();
  const connectedSigner = getTurnkeySigner(provider);
  const address = await connectedSigner.getAddress();
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
      SWAP_ROUTER_ADDRESS,
      amount.toString() // double check this
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
