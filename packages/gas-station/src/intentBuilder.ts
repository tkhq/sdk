import {
  encodeFunctionData,
  type WalletClient,
  type Account,
  type Chain,
  type Transport,
} from "viem";
import type { ContractCallParams, ExecutionIntent } from "./config";
import { ERC20_ABI, print } from "./gasStationUtils";

interface IntentBuilderConfig {
  eoaWalletClient: WalletClient<Transport, Chain, Account>;
  chainId: number;
  eoaAddress: `0x${string}`;
}

export class IntentBuilder {
  private config: IntentBuilderConfig;
  private outputContract?: `0x${string}`;
  private callData: `0x${string}` = "0x";
  private ethAmount: bigint = 0n;
  private nonce?: bigint;
  private deadline?: number;

  constructor(config: IntentBuilderConfig) {
    this.config = config;
  }

  /**
   * Set the target contract for this intent execution
   */
  setTarget(contract: `0x${string}`): this {
    this.outputContract = contract;
    return this;
  }

  /**
   * Set the ETH value to send with this intent
   */
  withValue(value: bigint): this {
    this.ethAmount = value;
    return this;
  }

  /**
   * Set a specific nonce (otherwise will be auto-fetched)
   */
  withNonce(nonce: bigint): this {
    this.nonce = nonce;
    return this;
  }

  /**
   * Set an expiration deadline (unix timestamp in seconds)
   * If not set, defaults to 1 hour from now
   */
  withDeadline(deadline: number): this {
    this.deadline = deadline;
    return this;
  }

  /**
   * Set the call data directly (for pre-encoded function calls)
   */
  withCallData(callData: `0x${string}`): this {
    this.callData = callData;
    return this;
  }

  /**
   * Add a contract call to this intent
   */
  callContract(params: ContractCallParams): this {
    this.outputContract = params.contract;
    this.callData = encodeFunctionData({
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
    });
    if (params.value) {
      this.ethAmount = params.value;
    }
    return this;
  }

  /**
   * Convenience method for ERC20 transfers
   */
  transferToken(token: `0x${string}`, to: `0x${string}`, amount: bigint): this {
    return this.callContract({
      contract: token,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [to, amount],
    });
  }

  /**
   * Convenience method for ERC20 approvals
   */
  approveToken(
    token: `0x${string}`,
    spender: `0x${string}`,
    amount: bigint,
  ): this {
    return this.callContract({
      contract: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, amount],
    });
  }

  /**
   * Convenience method for native ETH transfers
   */
  transferETH(to: `0x${string}`, amount: bigint): this {
    this.outputContract = to;
    this.callData = "0x";
    this.ethAmount = amount;
    return this;
  }

  /**
   * Signs the execution intent using EIP-712
   * Returns a complete ExecutionIntent ready for execution
   */
  async sign(currentNonce: bigint): Promise<ExecutionIntent> {
    if (!this.outputContract) {
      throw new Error(
        "No target contract set. Use setTarget() or callContract()",
      );
    }

    const nonce = this.nonce ?? currentNonce;
    // Default deadline: 1 hour from now
    const deadline =
      this.deadline ?? Math.floor(Date.now() / 1000) + 60 * 60;

    // EIP-712 domain and types for gas station execution
    const domain = {
      name: "TKGasDelegate",
      version: "1",
      chainId: this.config.chainId,
      verifyingContract: this.config.eoaAddress,
    };

    // Original: keccak256("Execution(uint128 nonce,uint32 deadline,address outputContract,uint256 ethAmount,bytes arguments)")
    const types = {
      Execution: [
        { name: "nonce", type: "uint128" },
        { name: "deadline", type: "uint32" },
        { name: "outputContract", type: "address" },
        { name: "ethAmount", type: "uint256" },
        { name: "arguments", type: "bytes" },
      ],
    };

    const message = {
      nonce,
      deadline,
      outputContract: this.outputContract,
      ethAmount: this.ethAmount,
      arguments: this.callData,
    };

    print("Signing EIP-712 execution intent...", "");

    const signature = await this.config.eoaWalletClient.signTypedData({
      account: this.config.eoaWalletClient.account,
      domain,
      types,
      primaryType: "Execution",
      message,
    });

    print(`✓ Intent signed: ${signature.slice(0, 20)}...`, "");

    return {
      nonce,
      deadline,
      outputContract: this.outputContract,
      ethAmount: this.ethAmount,
      callData: this.callData,
      signature,
      eoaAddress: this.config.eoaAddress,
    };
  }

  // Static factory method for quick intent creation
  static create(config: IntentBuilderConfig): IntentBuilder {
    return new IntentBuilder(config);
  }
}
