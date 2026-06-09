import {
  CoopExitService,
  getTransferPackageSigningPayload,
  Network,
  SparkRequestError,
  SparkValidationError,
} from "@buildonspark/spark-sdk";
import { uint8ArrayToHexString } from "@turnkey/encoding";
import {
  leafKeyTweakToTransferInputLeaf,
  normalizeTransferLeafKeyTweak,
  operatorsToOperatorRecipients,
  transferResultToTransferPackage,
} from "./transfer";
import type { ConnectorOutput, TurnkeySparkSigner } from "../signer";
import type { CooperativeExitResponse } from "@buildonspark/spark-sdk/dist/proto/spark";
import { v7 as uuidv7 } from "uuid";

type GetConnectorRefundSignaturesSignature =
  typeof CoopExitService.prototype.getConnectorRefundSignatures;

export type GetConnectorRefundSignaturesParams =
  Parameters<GetConnectorRefundSignaturesSignature>[0];

export type GetConnectorRefundSignaturesReturn = Awaited<
  ReturnType<GetConnectorRefundSignaturesSignature>
>;

export class TurnkeyCoopExitService extends CoopExitService {
  override async getConnectorRefundSignatures({
    leaves,
    exitTxId,
    connectorOutputs,
    receiverPubKey,
    transferId,
    connectorTx,
  }: GetConnectorRefundSignaturesParams): Promise<GetConnectorRefundSignaturesReturn> {
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

    const signer = this.config.signer as TurnkeySparkSigner;

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
            this.config.getNetwork() === Network.MAINNET
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
  }
}
