import {
  createWalletClient,
  http,
  encodeFunctionData,
  parseEther,
  type SignedAuthorization,
  type PublicClient,
} from "viem";
import { createAccount } from "@turnkey/viem";
import { gasStationAbi } from "../../abi/gas-station";
import type {
  GasStationConfig,
  TransferParams,
  ExecutionIntent,
  GasStationClients,
  ChainPreset,
} from "./config";
import { getPreset } from "./config";
import { IntentBuilder } from "./IntentBuilder";
import { print, createPublicClientForChain, ERC20_ABI } from "./helpers";

export class GasStationClient {
  private config: GasStationConfig;
  private clients?: GasStationClients;
  private publicClient: PublicClient;

  constructor(config: GasStationConfig) {
    this.config = config;
    this.publicClient = createPublicClientForChain(config.chain, config.rpcUrl);
  }

  /**
   * Factory method to create a GasStationClient from a preset configuration
   */
  static fromPreset(
    presetName: "BASE_MAINNET" | "ETHEREUM_MAINNET" | "SEPOLIA",
    config: {
      turnkeyClient: any;
      organizationId: string;
      eoaAddress: `0x${string}`;
      paymasterAddress: `0x${string}`;
      delegateContract: `0x${string}`;
      executionContract: `0x${string}`;
      overrides?: Partial<ChainPreset>;
    }
  ): GasStationClient {
    const preset = getPreset(presetName, config.overrides);

    return new GasStationClient({
      turnkeyClient: config.turnkeyClient,
      organizationId: config.organizationId,
      eoaAddress: config.eoaAddress,
      paymasterAddress: config.paymasterAddress,
      delegateContract: config.delegateContract,
      executionContract: config.executionContract,
      chain: preset.chain,
      rpcUrl: preset.rpcUrl,
      explorerUrl: preset.explorerUrl,
    });
  }

  /**
   * Initialize wallet clients for EOA and paymaster
   * Called automatically before operations that need them
   */
  private async ensureClients(): Promise<GasStationClients> {
    if (this.clients) {
      return this.clients;
    }

    const eoaAccount = await createAccount({
      client: this.config.turnkeyClient.apiClient(),
      organizationId: this.config.organizationId,
      signWith: this.config.eoaAddress,
    });

    const paymasterAccount = await createAccount({
      client: this.config.turnkeyClient.apiClient(),
      organizationId: this.config.organizationId,
      signWith: this.config.paymasterAddress,
    });

    const eoaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: this.config.chain,
      transport: http(this.config.rpcUrl),
    });

    const paymasterWalletClient = createWalletClient({
      account: paymasterAccount,
      chain: this.config.chain,
      transport: http(this.config.rpcUrl),
    });

    this.clients = { eoaWalletClient, paymasterWalletClient };
    return this.clients;
  }

  /**
   * Authorize the EOA to use the gas station contract via EIP-7702
   * This only needs to be called once per EOA
   */
  async authorize(): Promise<{ txHash: `0x${string}`; blockNumber: bigint }> {
    print("===== Starting EIP-7702 Authorization =====", "");

    const { eoaWalletClient, paymasterWalletClient } =
      await this.ensureClients();

    // Sign EIP-7702 authorization to delegate the contract to the EOA
    const authorization = await eoaWalletClient.signAuthorization({
      contractAddress: this.config.delegateContract,
      account: eoaWalletClient.account,
      chainId: 0, // 0 means valid on any EIP-7702 compatible chain
    });

    // Paymaster broadcasts the authorization transaction
    const authTxHash = await paymasterWalletClient.sendTransaction({
      from: "0x0000000000000000000000000000000000000000",
      gas: BigInt(200000),
      authorizationList: [authorization as SignedAuthorization],
      to: "0x0000000000000000000000000000000000000000",
      type: "eip7702",
      account: paymasterWalletClient.account,
    });

    print(
      "Authorization transaction sent",
      `${this.config.explorerUrl}/tx/${authTxHash}`
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
   * Get the current nonce for the EOA from the gas station contract
   */
  async getNonce(): Promise<bigint> {
    const { eoaWalletClient } = await this.ensureClients();

    const nonce = await this.publicClient.readContract({
      address: this.config.executionContract,
      abi: gasStationAbi,
      functionName: "getNonce",
      args: [eoaWalletClient.account.address],
    });

    return nonce as bigint;
  }

  /**
   * Create an intent builder for composing complex transactions
   */
  async createIntent(): Promise<IntentBuilder> {
    const { eoaWalletClient } = await this.ensureClients();

    return IntentBuilder.create({
      eoaWalletClient,
      chainId: this.config.chain.id,
      eoaAddress: this.config.eoaAddress,
      nonceType: "uint128",
    });
  }

  /**
   * Execute a signed intent through the gas station contract
   */
  async executeIntent(
    intent: ExecutionIntent
  ): Promise<{ txHash: `0x${string}`; blockNumber: bigint; gasUsed: bigint }> {
    const { paymasterWalletClient } = await this.ensureClients();

    print("Executing intent via gas station...", "");

    const txHash = await paymasterWalletClient.sendTransaction({
      to: this.config.executionContract,
      data: encodeFunctionData({
        abi: gasStationAbi,
        functionName: "execute",
        args: [
          intent.eoaAddress,
          intent.nonce,
          intent.outputContract,
          intent.ethAmount,
          intent.callData,
          intent.signature,
        ],
      }),
      gas: BigInt(200000),
      account: paymasterWalletClient.account,
    });

    print(
      "Execution transaction sent",
      `${this.config.explorerUrl}/tx/${txHash}`
    );
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

  /**
   * Execute a generic action through the gas station
   * This is the core execution method that maps to the contract's execute function
   *
   * @param params - Execution parameters (outputContract, callData, value)
   * @returns Transaction receipt with txHash, blockNumber, and gasUsed
   */
  async execute(params: {
    outputContract: `0x${string}`;
    callData: `0x${string}`;
    value?: bigint;
  }): Promise<{
    txHash: `0x${string}`;
    blockNumber: bigint;
    gasUsed: bigint;
  }> {
    print("===== Preparing Execution =====", "");

    const nonce = await this.getNonce();
    print(`Current nonce: ${nonce}`, "");

    const builder = await this.createIntent();

    // Set the target contract and value
    builder.setTarget(params.outputContract).withValue(params.value ?? 0n);

    // Set the callData directly (it's already encoded by the helpers)
    (builder as any).callData = params.callData;

    const intent = await builder.sign(nonce);
    const result = await this.executeIntent(intent);

    print("===== Execution Complete =====", "");
    return result;
  }
}
