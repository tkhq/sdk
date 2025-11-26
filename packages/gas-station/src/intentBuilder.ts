import {
  encodeFunctionData,
  type WalletClient,
  type Account,
  type Chain,
  type Transport,
  type Hex,
} from "viem";
import type {
  ContractCallParams,
  ExecutionIntent,
  ApprovalExecutionIntent,
} from "./config";
import { ERC20_ABI, packSessionSignature } from "./gasStationUtils";

interface IntentBuilderConfig {
  eoaWalletClient: WalletClient<Transport, Chain, Account>;
  chainId: number;
  eoaAddress: Hex;
}

export class IntentBuilder {
  private config: IntentBuilderConfig;
  private outputContract?: Hex;
  private callData: Hex = "0x";
  private ethAmount: bigint = 0n;
  private nonce?: bigint;
  private deadline?: number;

  constructor(config: IntentBuilderConfig) {
    this.config = config;
  }

  /**
   * Set the target contract for this intent execution
   */
  setTarget(contract: Hex): this {
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
  withCallData(callData: Hex): this {
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
  transferToken(token: Hex, to: Hex, amount: bigint): this {
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
  approveToken(token: Hex, spender: Hex, amount: bigint): this {
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
  transferETH(to: Hex, amount: bigint): this {
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
    const deadline = this.deadline ?? Math.floor(Date.now() / 1000) + 60 * 60;

    // EIP-712 domain and types for gas station execution
    const domain = {
      name: "TKGasDelegate",
      version: "1",
      chainId: this.config.chainId,
      verifyingContract: this.config.eoaAddress,
    };

    // keccak256("Execution(uint128 nonce,uint32 deadline,address to,uint256 value,bytes data)")
    const types = {
      Execution: [
        { name: "nonce", type: "uint128" },
        { name: "deadline", type: "uint32" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
      ],
    };

    const message = {
      nonce,
      deadline,
      to: this.outputContract,
      value: this.ethAmount,
      data: this.callData,
    };

    const signature = await this.config.eoaWalletClient.signTypedData({
      account: this.config.eoaWalletClient.account,
      domain,
      types,
      primaryType: "Execution",
      message,
    });

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

  /**
   * Signs an approval then execution intent using EIP-712
   * This allows atomic approval of an ERC20 token followed by execution
   * Returns a complete ApprovalExecutionIntent ready for execution
   */
  async signApprovalExecution(
    currentNonce: bigint,
    erc20Address: Hex,
    spender: Hex,
    approveAmount: bigint,
  ): Promise<ApprovalExecutionIntent> {
    if (!this.outputContract) {
      throw new Error(
        "No target contract set. Use setTarget() or callContract()",
      );
    }

    const nonce = this.nonce ?? currentNonce;
    // Default deadline: 1 hour from now
    const deadline = this.deadline ?? Math.floor(Date.now() / 1000) + 60 * 60;

    // EIP-712 domain and types for approve then execute
    const domain = {
      name: "TKGasDelegate",
      version: "1",
      chainId: this.config.chainId,
      verifyingContract: this.config.eoaAddress,
    };

    // Based on hashApproveThenExecute from the contract
    // keccak256("ApproveThenExecute(uint128 nonce,uint32 deadline,address erc20Contract,address spender,uint256 approveAmount,address to,uint256 value,bytes data)")
    const types = {
      ApproveThenExecute: [
        { name: "nonce", type: "uint128" },
        { name: "deadline", type: "uint32" },
        { name: "erc20Contract", type: "address" },
        { name: "spender", type: "address" },
        { name: "approveAmount", type: "uint256" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
      ],
    };

    const message = {
      nonce,
      deadline,
      erc20Contract: erc20Address,
      spender,
      approveAmount,
      to: this.outputContract,
      value: this.ethAmount,
      data: this.callData,
    };

    const signature = await this.config.eoaWalletClient.signTypedData({
      account: this.config.eoaWalletClient.account,
      domain,
      types,
      primaryType: "ApproveThenExecute",
      message,
    });

    return {
      nonce,
      deadline,
      outputContract: this.outputContract,
      ethAmount: this.ethAmount,
      callData: this.callData,
      signature,
      eoaAddress: this.config.eoaAddress,
      erc20Address,
      spender,
      approveAmount,
    };
  }

  /**
   * Signs a session signature for USDC transfer authorization in the reimbursable gas station.
   * This authorizes the reimbursable contract to interact with the USDC contract on behalf of the EOA.
   * The session signature does NOT commit to a specific amount - amounts are specified at execution time.
   * This allows the same session signature to be cached and reused for multiple transactions.
   * Returns an 85-byte packed signature that can be passed to executeWithReimbursement().
   */
  async signSessionForUSDCTransfer(
    currentNonce: bigint,
    usdcAddress: Hex,
    reimbursableContract: Hex,
    sessionDeadline?: number,
  ): Promise<Hex> {
    const nonce = this.nonce ?? currentNonce;
    // Default deadline: 1 hour from now
    const deadline =
      sessionDeadline ?? Math.floor(Date.now() / 1000) + 60 * 60;

    // EIP-712 domain and types for session execution
    const domain = {
      name: "TKGasDelegate",
      version: "1",
      chainId: this.config.chainId,
      verifyingContract: this.config.eoaAddress,
    };

    // Based on hashSessionExecution from the delegate contract
    // keccak256("SessionExecution(uint128 counter,uint32 deadline,address sender,address to)")
    const types = {
      SessionExecution: [
        { name: "counter", type: "uint128" },
        { name: "deadline", type: "uint32" },
        { name: "sender", type: "address" },
        { name: "to", type: "address" },
      ],
    };

    const message = {
      counter: nonce,
      deadline,
      sender: reimbursableContract,
      to: usdcAddress,
    };

    const signature = await this.config.eoaWalletClient.signTypedData({
      account: this.config.eoaWalletClient.account,
      domain,
      types,
      primaryType: "SessionExecution",
      message,
    });

    return packSessionSignature({ signature, nonce, deadline });
  }

  // Static factory method for quick intent creation
  static create(config: IntentBuilderConfig): IntentBuilder {
    return new IntentBuilder(config);
  }
}
