import {
  type ConfigOptions,
  getTransferPackageSigningPayload,
  Network,
  SparkRequestError,
  SparkSigner,
  SparkValidationError,
  SparkWallet,
} from "@buildonspark/spark-sdk";
import {
  leafKeyTweakToTransferInputLeaf,
  normalizeTransferLeafKeyTweak,
  operatorsToOperatorRecipients,
  transferResultToTransferPackage,
  TurnkeyTransferService,
} from "./services/transfer";
import { v7 as uuidv7 } from "uuid";
import type { CooperativeExitResponse } from "@buildonspark/spark-sdk/dist/proto/spark";
import { uint8ArrayToHexString } from "@turnkey/encoding";
import type { ConnectorOutput, TurnkeySparkSigner } from "./signer";

export class TurnkeySparkWallet extends SparkWallet {
  constructor(options?: ConfigOptions, signerArg?: SparkSigner) {
    super(options, signerArg);

    this.transferService = new TurnkeyTransferService(
      this.config,
      this.connectionManager,
      this.signingService,
    );

    // Disable the SDK's claim-time auto-optimize swap. The optimizer splits a
    // freshly-claimed leaf into binary denominations via the swap path, leaving
    // each new leaf in SWAP_PENDING locally. The SO-side state transitions to
    // AVAILABLE only after the swap finalizes, which the in-process LeafManager
    // sees only via a fresh sync — short-lived example runs that try to
    // withdraw/transfer immediately after a claim see available=0 because every
    // local leaf is SWAP_PENDING. Disabling the auto-optimize keeps the claim's
    // leaf AVAILABLE so the next operation proceeds. Users who want
    // optimization can call wallet.optimizeLeaves() explicitly and await it.
    Object.assign(this.leafManager, {
      transferService: this.transferService,
      onAutoOptimize: async () => undefined,
    });

    Object.assign(this.swapService, { transferService: this.transferService });

    Object.assign(this.coopExitService, {
      getConnectorRefundSignatures: this.createGetConnectorRefundSignatures(),
    });
  }

  /**
   * Temporary hack before CoopExitService gets exported from spark SDK
   */
  private createGetConnectorRefundSignatures() {
    type GetConnectorRefundSignatures =
      typeof this.coopExitService.getConnectorRefundSignatures;

    const signer = this.config.signer as TurnkeySparkSigner;

    const getConnectorRefundSignatures: GetConnectorRefundSignatures = async ({
      leaves,
      exitTxId,
      connectorOutputs,
      receiverPubKey,
      transferId,
      connectorTx,
    }) => {
      if (leaves.length !== connectorOutputs.length) {
        throw new SparkValidationError(
          "Mismatch between leaves and connector outputs",
          {
            field: "leaves/connectorOutputs",
            value: {
              leavesCount: leaves.length,
              outputsCount: connectorOutputs.length,
            },
            expected: "Equal length",
          },
        );
      }

      const receiverPublicKeyHex = uint8ArrayToHexString(receiverPubKey);
      const normalizedLeaves = leaves.map(normalizeTransferLeafKeyTweak);
      const operatorRecipients = operatorsToOperatorRecipients(
        this.config.getSigningOperators(),
      );
      const transferLeafInputs = normalizedLeaves.map(
        leafKeyTweakToTransferInputLeaf,
      );

      const transferResult = await signer.prepareTransfer({
        transferId,
        leaves: transferLeafInputs,
        threshold: this.config.getThreshold(),
        operatorRecipients,
        receiverPublicKey: receiverPublicKeyHex,
      });

      // 2. Get SO signing commitments (3 per leaf: cpfp, direct, directFromCpfp)
      const sparkClient = await this.connectionManager.createSparkClient(
        this.config.getCoordinatorAddress(),
      );

      const { signingCommitments: commitments } =
        await sparkClient.get_signing_commitments({
          nodeIds: leaves.map(({ leaf }) => leaf.id),
          count: 3,
        });

      const signRefundsResult = await signer.signRefundsBatchedCoopExit({
        leaves: normalizedLeaves,
        network: this.config.getNetwork(),
        commitments,
        connectorOutputs: connectorOutputs as ConnectorOutput[],
        connectorTx,
      });

      const transferPackage = transferResultToTransferPackage(
        transferResult,
        signRefundsResult,
      );

      const transferPackageSigningPayload = getTransferPackageSigningPayload(
        transferId,
        transferPackage,
      );
      const signature = await signer.signMessageWithIdentityKey(
        transferPackageSigningPayload,
      );
      transferPackage.userSignature = new Uint8Array(signature);

      // 5. Call cooperative_exit_v2 with TransferPackage
      let response: CooperativeExitResponse;
      try {
        response = await sparkClient.cooperative_exit_v2({
          transfer: {
            transferId,
            ownerIdentityPublicKey:
              await this.config.signer.getIdentityPublicKey(),
            receiverIdentityPublicKey: receiverPubKey,
            transferPackage,
            expiryTime:
              this.config.getNetwork() == Network.MAINNET
                ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000)
                : new Date(Date.now() + 35 * 60 * 1000),
          },
          exitId: uuidv7(),
          exitTxid: exitTxId,
          connectorTx: connectorTx,
        });
      } catch (error) {
        throw new SparkRequestError("Failed to initiate cooperative exit", {
          operation: "cooperative_exit_v2",
          error,
        });
      }

      if (!response.transfer) {
        throw new SparkRequestError("Failed to initiate cooperative exit", {
          operation: "cooperative_exit_v2",
          error: new Error("No transfer in response"),
        });
      }

      return { transfer: response.transfer };
    };

    return getConnectorRefundSignatures;
  }
}
