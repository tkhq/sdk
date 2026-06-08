import {
  TransferService,
  KeyDerivationType,
  getClaimPackageSigningPayload,
  SparkRequestError,
  SparkValidationError,
  getSigHashFromTx,
  getTxFromRawTxBytes,
  SparkAddressFormat,
  SigningOperator,
  KeyDerivation,
} from "@buildonspark/spark-sdk";
import type {
  Transfer,
  TreeNode,
  ClaimPackage,
  ClaimTransferResponse,
  InitiateSwapPrimaryTransferResponse,
  StartTransferResponse,
  TransferLeaf,
  TransferPackage,
} from "@buildonspark/spark-sdk/dist/proto/spark";
import { secp256k1 } from "@noble/curves/secp256k1";
import {
  uint8ArrayToHexString,
  uint8ArrayFromHexString,
} from "@turnkey/encoding";
import { v7 as uuidv7 } from "uuid";
import type {
  TurnkeySparkSigner,
  ClaimLeafInput,
  ClaimLeaf,
  OperatorRecipientInput,
  SignRefundsResult,
  TransferLeafInput,
  TransferResult,
  UserSignedTxSigningJobWithSelfCommitment,
  OperatorPackage,
} from "../signer";
import { compactEcdsaSignature } from "../utils";

export class TurnkeyTransferService extends TransferService {
  override async claimTransferCore(transfer: Transfer): Promise<TreeNode[]> {
    const config = this.config;
    const signer = config.signer as TurnkeySparkSigner;

    const leaves = (transfer.leaves ?? []).filter(isLeafWithTreeNode);
    const claimLeafInputs: ClaimLeafInput[] = leaves.map(
      ({ leaf, secretCipher, signature }) => ({
        leafId: leaf.id,
        ciphertext: uint8ArrayToHexString(secretCipher),
        senderSignature: uint8ArrayToHexString(
          compactEcdsaSignature(signature),
        ),
      }),
    );

    const operatorRecipients = operatorsToOperatorRecipients(
      config.getSigningOperators(),
    );

    const preparedClaim = await signer.prepareClaim({
      leaves: claimLeafInputs,
      threshold: config.getThreshold(),
      operatorRecipients,
      transferId: transfer.id,
      senderIdentityPublicKey: uint8ArrayToHexString(
        transfer.senderIdentityPublicKey,
      ),
    });

    const newLeafPublicKeys = preparedClaim.newLeafPublicKeys ?? [];
    const newPublicKeysByLeafId = Object.fromEntries(
      newLeafPublicKeys.map(({ leafId, publicKey }) => [
        leafId,
        uint8ArrayFromHexString(publicKey),
      ]),
    );

    const claimLeaves = leaves.map(
      ({ leaf }): ClaimLeaf => ({
        leaf: leaf,
        keyDerivation: { type: KeyDerivationType.LEAF, path: leaf.id },
        newKeyDerivation: { type: KeyDerivationType.LEAF, path: leaf.id },
        signingPublicKey: newPublicKeysByLeafId[leaf.id],
        receiverIdentityPublicKey: newPublicKeysByLeafId[leaf.id],
      }),
    );

    const sparkClient = await this.connectionManager.createSparkClient(
      this.config.getCoordinatorAddress(),
    );
    const { signingCommitments: commitments } =
      await sparkClient.get_signing_commitments({
        nodeIdCount: claimLeaves.length,
        count: 3,
      });

    const signedLeaves = await signer.signRefundsBatchedClaim({
      leaves: claimLeaves,
      network: this.config.getNetwork(),
      commitments,
    });

    const keyTweakPackage = operatorPackagesToKeyTweakPackage(
      preparedClaim.operatorPackages,
    );
    const keyTweakPackageSignature = await signer.signMessageWithIdentityKey(
      getClaimPackageSigningPayload(transfer.id, keyTweakPackage),
    );

    // ── Phase 3: Assemble and send ────────────────────────────────────
    const claimPackage: ClaimPackage = {
      leavesToClaim: signedLeaves.leaves,
      directLeavesToClaim: signedLeaves.directLeaves,
      directFromCpfpLeavesToClaim: signedLeaves.directFromCpfpLeaves,
      keyTweakPackage,
      userSignature: keyTweakPackageSignature,
      hashVariant: 1,
    };

    let response: ClaimTransferResponse;
    try {
      response = await sparkClient.claim_transfer({
        transferId: transfer.id,
        ownerIdentityPublicKey: await this.config.signer.getIdentityPublicKey(),
        claimPackage,
      });
    } catch (error: unknown) {
      throw new SparkRequestError("Failed to claim transfer", {
        method: "POST",
        error,
      });
    }
    if (!response.transfer) {
      throw new SparkValidationError(
        "No transfer response from claim_transfer",
      );
    }
    const nodes = response.transfer.leaves.flatMap((leaf) =>
      leaf.leaf ? [leaf.leaf] : [],
    );
    return nodes;
  }

  override async sendSwapTransfer(
    leaves: LeafKeyTweak[],
    transferId: string = uuidv7(),
  ): Promise<{
    swapTransfer: InitiateSwapPrimaryTransferResponse;
    adaptorPubkey: Uint8Array;
    adaptorAddedSignatureMap: Map<string, Uint8Array>;
  }> {
    if (leaves.length === 0) {
      throw new SparkValidationError("leaves must not be empty");
    }

    const signer = this.config.signer as TurnkeySparkSigner;
    const sparkClient = await this.connectionManager.createSparkClient(
      this.config.getCoordinatorAddress(),
    );

    const { signingCommitments: commitments } =
      await sparkClient.get_signing_commitments({
        nodeIds: leaves.map(({ leaf }) => leaf.id),
        count: 3,
      });

    const normalizedLeaves = leaves.map(normalizeTransferLeafKeyTweak);
    const adaptorPrivKey = secp256k1.utils.randomSecretKey();
    const adaptorPubKey = secp256k1.getPublicKey(adaptorPrivKey);
    const signRefundsResult = await signer.signRefundsBatchedTransfer({
      network: this.config.getNetwork(),
      leaves: normalizedLeaves,
      commitments,
      adaptorPubKey,
    });

    const ownerIdentityPublicKey = await signer.getIdentityPublicKey();
    const receiverPublicKey = leaves[0]!.receiverIdentityPublicKey;
    const receiverPublicKeyHex = uint8ArrayToHexString(
      leaves[0]!.receiverIdentityPublicKey,
    );
    const operatorRecipients = operatorsToOperatorRecipients(
      this.config.getSigningOperators(),
    );
    const transferLeafInputs = normalizedLeaves.map(
      leafKeyTweakToTransferInputLeaf,
    );

    // ── Phase 2: Key tweaks via Turnkey enclave ────────────────────
    // The enclave atomically: derives old/new leaf keys, computes tweak,
    // Feldman-splits across operators, ECIES-encrypts per-leaf data, and
    // signs the transfer package payload (ECDSA-DER). Refund FROST signing
    // already happened in phase 1 via SPARK_SIGN_FROST.
    const transferResult = await signer.prepareTransfer({
      transferId,
      leaves: transferLeafInputs,
      threshold: this.config.getThreshold(),
      operatorRecipients,
      receiverPublicKey: receiverPublicKeyHex,
    });

    const transferPackage = transferResultToTransferPackage(
      transferResult,
      signRefundsResult,
    );

    transferPackage.directFromCpfpLeavesToSend = [];
    transferPackage.directLeavesToSend = [];
    try {
      const response = await sparkClient.initiate_swap_primary_transfer({
        transfer: {
          transferId,
          ownerIdentityPublicKey,
          receiverIdentityPublicKey: receiverPublicKey,
          transferPackage,
        },
        adaptorPublicKeys: {
          adaptorPublicKey: adaptorPubKey,
        },
      });

      if (!response.transfer) {
        throw new SparkValidationError("No transfer response from operator");
      }

      const adaptorAddedSignatureMap: Map<string, Uint8Array> = new Map();
      for (const signingResult of response.signingResults) {
        const leaf = transferPackage.leavesToSend.find(
          (leaf) => leaf.leafId === signingResult.leafId,
        );
        const leaf_1 = leaves.find(
          (leaf) => leaf.leaf.id === signingResult.leafId,
        );
        if (!leaf || !leaf_1) {
          throw new SparkValidationError("Leaf not found", {
            field: "leafId",
            value: signingResult.leafId,
          });
        }

        const message = getSigHashFromTx(
          getTxFromRawTxBytes(leaf.rawTx),
          0,
          getTxFromRawTxBytes(leaf_1.leaf.nodeTx).getOutput(0),
        );
        const adaptorAddedSignature = await this.config.signer.aggregateFrost({
          message: message,
          publicKey: leaf.signingPublicKey,
          verifyingKey: signingResult.verifyingKey,
          selfCommitment: leaf.selfCommitment,
          statechainCommitments:
            signingResult.refundTxSigningResult?.signingNonceCommitments,
          statechainSignatures:
            signingResult.refundTxSigningResult?.signatureShares,
          statechainPublicKeys: signingResult.refundTxSigningResult?.publicKeys,
          selfSignature: leaf.userSignature,
          adaptorPubKey,
        });
        adaptorAddedSignatureMap.set(
          signingResult.leafId,
          adaptorAddedSignature,
        );
      }

      return {
        swapTransfer: response,
        adaptorPubkey: adaptorPubKey,
        adaptorAddedSignatureMap,
      };
    } catch (error) {
      throw new SparkRequestError("Failed to initiate swap primary transfer", {
        method: "POST",
        error: error as Error,
      });
    }
  }

  override async sendTransferWithKeyTweaks(
    leaves: LeafKeyTweak[],
    _?: SparkAddressFormat,
  ): Promise<Transfer> {
    if (leaves.length === 0) {
      throw new SparkValidationError("leaves must not be empty");
    }

    const transferId = uuidv7();

    const signer = this.config.signer as TurnkeySparkSigner;
    const sparkClient = await this.connectionManager.createSparkClient(
      this.config.getCoordinatorAddress(),
    );

    const { signingCommitments: commitments } =
      await sparkClient.get_signing_commitments({
        nodeIds: leaves.map(({ leaf }) => leaf.id),
        count: 3,
      });

    const normalizedLeaves = leaves.map(normalizeTransferLeafKeyTweak);
    const signRefundsResult = await signer.signRefundsBatchedTransfer({
      network: this.config.getNetwork(),
      leaves: normalizedLeaves,
      commitments,
    });

    const receiverPublicKey = leaves[0]!.receiverIdentityPublicKey;
    const receiverPublicKeyHex = uint8ArrayToHexString(
      leaves[0]!.receiverIdentityPublicKey,
    );
    const operatorRecipients = operatorsToOperatorRecipients(
      this.config.getSigningOperators(),
    );
    const transferLeafInputs = normalizedLeaves.map(
      leafKeyTweakToTransferInputLeaf,
    );

    // ── Phase 2: Key tweaks via Turnkey enclave ────────────────────
    // The enclave atomically: derives old/new leaf keys, computes tweak,
    // Feldman-splits across operators, ECIES-encrypts per-leaf data, and
    // signs the transfer package payload (ECDSA-DER). Refund FROST signing
    // already happened in phase 1 via SPARK_SIGN_FROST.
    const transferResult = await signer.prepareTransfer({
      transferId,
      leaves: transferLeafInputs,
      threshold: this.config.getThreshold(),
      operatorRecipients,
      receiverPublicKey: receiverPublicKeyHex,
    });

    const receiverIdentityPublicKeys = Object.fromEntries(
      leaves.map(({ leaf }) => [leaf.id, receiverPublicKey]),
    );

    let response: StartTransferResponse;

    try {
      response = await sparkClient.start_transfer_v3({
        transferId,
        senderPackages: [
          {
            ownerIdentityPublicKey: await signer.getIdentityPublicKey(),
            transferPackage: transferResultToTransferPackage(
              transferResult,
              signRefundsResult,
            ),
            receiverIdentityPublicKeys,
          },
        ],
        expiryTime: undefined,
      });
    } catch (error) {
      throw new SparkRequestError("Failed to start transfer", {
        method: "POST",
        error,
      });
    }

    if (!response.transfer) {
      throw new SparkValidationError("No transfer response from operator");
    }

    return response.transfer;
  }
}

type TransferLeafWithTreeNode = TransferLeaf & { leaf: TreeNode };
const isLeafWithTreeNode = (
  value: TransferLeaf,
): value is TransferLeafWithTreeNode => value.leaf != null;

const leafKeyTweakToTransferInputLeaf = (
  leaf: LeafKeyTweak,
): TransferLeafInput => ({
  leafId: leaf.leaf.id,
  oldLeafDerivation: leaf.keyDerivation,
  newLeafDerivation: leaf.newKeyDerivation,
});

const normalizeTransferLeafKeyTweak = (
  leafKeyTweak: LeafKeyTweak,
): LeafKeyTweak => ({
  ...leafKeyTweak,
  newKeyDerivation: { type: KeyDerivationType.LEAF, path: uuidv7() },
});

/**
 * Build the operator-recipients list for transfer/claim/swap/withdraw/lightning
 * package construction.
 *
 * The numeric-id sort is load-bearing — the signer assigns Feldman polynomial
 * evaluation points by *array position*, so position-N must hold operator-with-id-N
 * for every operator to reconstruct its share at the expected x-coordinate.
 * Pre-sort, `Object.values()` insertion order would scramble the assignment and
 * operators couldn't reconstruct. See commit 558d66361 for the original incident.
 */
const operatorsToOperatorRecipients = (
  operators: Readonly<Record<string, SigningOperator>>,
): OperatorRecipientInput[] =>
  Object.values(operators)
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((op) => ({
      operatorId: op.identifier,
      encryptionPublicKey: op.identityPublicKey,
    }));

interface LeafKeyTweak {
  leaf: TreeNode;
  keyDerivation: KeyDerivation;
  newKeyDerivation: KeyDerivation;
  receiverIdentityPublicKey: Uint8Array;
}

interface TransferPackageWithSelfCommitments extends TransferPackage {
  leavesToSend: UserSignedTxSigningJobWithSelfCommitment[];
  directLeavesToSend: UserSignedTxSigningJobWithSelfCommitment[];
  directFromCpfpLeavesToSend: UserSignedTxSigningJobWithSelfCommitment[];
}

/**
 * Assemble a TransferPackage from a Turnkey enclave result + signed refund jobs.
 * */
const transferResultToTransferPackage = (
  transferResult: TransferResult,
  signRefundsResult: SignRefundsResult,
): TransferPackageWithSelfCommitments => {
  return {
    leavesToSend: signRefundsResult.leaves,
    directLeavesToSend: signRefundsResult.directLeaves,
    directFromCpfpLeavesToSend: signRefundsResult.directFromCpfpLeaves,
    keyTweakPackage: operatorPackagesToKeyTweakPackage(
      transferResult.operatorPackages,
    ),
    userSignature: uint8ArrayFromHexString(
      transferResult.transferUserSignature,
    ),
    hashVariant: 1,
  };
};

const operatorPackagesToKeyTweakPackage = (
  operatorPackages: OperatorPackage[],
): Record<string, Uint8Array> =>
  Object.fromEntries(
    operatorPackages.map(({ operatorId, encryptedPackage }) => [
      operatorId,
      uint8ArrayFromHexString(encryptedPackage),
    ]),
  );
