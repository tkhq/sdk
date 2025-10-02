import {
  encodeFunctionData,
  type SignedAuthorization,
  type PublicClient,
  type WalletClient,
  type Account,
  type Chain,
  type Transport,
} from "viem";
import { gasStationAbi } from "../../abi/gas-station";
import type {
  GasStationConfig,
  TransferParams,
  ExecutionIntent,
} from "./config";
import {
  DEFAULT_DELEGATE_CONTRACT,
  DEFAULT_EXECUTION_CONTRACT,
} from "./config";
import { IntentBuilder } from "./IntentBuilder";
import {
  print,
  createPublicClientForChain,
  packExecutionData,
  packExecutionDataNoValue,
} from "./helpers";

export class GasStationClient {
  private walletClient: WalletClient<Transport, Chain, Account>;
  private publicClient: PublicClient;
  private delegateContract: `0x${string}`;
  private executionContract: `0x${string}`;
  private explorerUrl: string;

  constructor(config: GasStationConfig) {
    this.walletClient = config.walletClient;
    this.publicClient = createPublicClientForChain(
      config.walletClient.chain,
      config.walletClient.transport.url!
    );
    this.delegateContract =
      config.delegateContract ?? DEFAULT_DELEGATE_CONTRACT;
    this.executionContract =
      config.executionContract ?? DEFAULT_EXECUTION_CONTRACT;
    this.explorerUrl = config.explorerUrl;
  }

  /**
   * Sign an EIP-7702 authorization to delegate control to the gas station contract
   * Call this with an end-user client to get a signed authorization
   * The authorization can then be submitted by the paymaster using submitAuthorization()
   */
  async signAuthorization(): Promise<SignedAuthorization> {
    print("Signing EIP-7702 authorization...", "");

    const authorization = await this.walletClient.signAuthorization({
      contractAddress: this.delegateContract,
      account: this.walletClient.account,
      chainId: 0, // 0 means valid on any EIP-7702 compatible chain
    });

    print("✓ Authorization signed", "");

    return authorization as SignedAuthorization;
  }

  /**
   * Submit a signed EIP-7702 authorization transaction
   * Call this with a paymaster client to broadcast the authorization transaction
   * The paymaster pays for the gas
   */
  async submitAuthorization(
    authorization: SignedAuthorization
  ): Promise<{ txHash: `0x${string}`; blockNumber: bigint }> {
    print("Submitting authorization transaction...", "");

    const authTxHash = await this.walletClient.sendTransaction({
      from: "0x0000000000000000000000000000000000000000",
      gas: BigInt(200000),
      authorizationList: [authorization],
      to: "0x0000000000000000000000000000000000000000",
      type: "eip7702",
      account: this.walletClient.account,
    });

    print(
      "Authorization transaction sent",
      `${this.explorerUrl}/tx/${authTxHash}`
    );
    print("Waiting for confirmation...", "");

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: authTxHash,
    });

    if (receipt.status === "success") {
      print("✅ Authorization SUCCEEDED", "");
      print(
        "Confirmed",
        `Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}`
      );
    } else {
      print("❌ Authorization FAILED", "");
      throw new Error("Authorization failed - cannot proceed");
    }

    return { txHash: authTxHash, blockNumber: receipt.blockNumber };
  }

  /**
   * Convenience method that combines signAuthorization and submitAuthorization
   * This requires the caller to have access to both the end-user and paymaster clients
   * For separate flows, use signAuthorization() and submitAuthorization() directly
   */
  async authorize(
    paymasterClient: GasStationClient
  ): Promise<{ txHash: `0x${string}`; blockNumber: bigint }> {
    print("===== Starting EIP-7702 Authorization =====", "");

    // End user signs the authorization
    const authorization = await this.signAuthorization();

    // Paymaster submits the transaction
    const result = await paymasterClient.submitAuthorization(authorization);

    return result;
  }

  /**
   * Get the current nonce for an EOA address from the gas station contract
   * If no address is provided, uses the signer's address
   */
  async getNonce(eoaAddress?: `0x${string}`): Promise<bigint> {
    const address = eoaAddress ?? this.walletClient.account.address;

    const nonce = await this.publicClient.readContract({
      address: this.executionContract,
      abi: gasStationAbi,
      functionName: "getNonce",
      args: [address],
    });

    return nonce as bigint;
  }

  /**
   * Create an intent builder for composing complex transactions
   * Call this with an end-user client to create intents for signing
   */
  createIntent(): IntentBuilder {
    if (!this.walletClient.account?.address) {
      throw new Error(
        `Wallet client account is not properly configured. Account: ${JSON.stringify(this.walletClient.account)}`
      );
    }
    return IntentBuilder.create({
      eoaWalletClient: this.walletClient,
      chainId: this.walletClient.chain.id,
      eoaAddress: this.walletClient.account.address,
      nonceType: "uint128",
    });
  }

  /**
   * Execute a signed intent through the gas station contract.
   * Packs the execution data according to the delegate contract's expected format and
   * submits it via the execution contract.
   * Call this with a paymaster client to submit and pay for the transaction.
   */
  async execute(
    intent: ExecutionIntent
  ): Promise<{ txHash: `0x${string}`; blockNumber: bigint; gasUsed: bigint }> {
    print("Executing intent via gas station...", "");

    // Pack the execution data based on whether we're sending ETH
    const packedData =
      intent.ethAmount > 0n
        ? packExecutionData(
            intent.signature,
            intent.nonce,
            intent.outputContract,
            intent.ethAmount,
            intent.callData
          )
        : packExecutionDataNoValue(
            intent.signature,
            intent.nonce,
            intent.outputContract,
            intent.callData
          );

    // Determine which function to call based on ETH amount
    const functionName = intent.ethAmount > 0n ? "execute" : "executeNoValue";

    const txHash = await this.walletClient.sendTransaction({
      to: this.executionContract,
      data: encodeFunctionData({
        abi: gasStationAbi,
        functionName,
        args: [intent.eoaAddress, packedData],
      }),
      gas: BigInt(200000),
      account: this.walletClient.account,
    });

    print("Execution transaction sent", `${this.explorerUrl}/tx/${txHash}`);
    print("Waiting for confirmation...", "");

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status === "success") {
      print("✅ Execution SUCCEEDED", "");
      print(
        "Confirmed",
        `Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}`
      );
    } else {
      print("❌ Execution FAILED", "");
      throw new Error("Execution failed");
    }

    return {
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  }
}
