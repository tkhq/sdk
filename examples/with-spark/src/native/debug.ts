import type {
  SignFrostParams,
  SigningCommitment,
  SparkSigner,
  SparkWallet,
} from "@buildonspark/spark-sdk";

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function isEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes"].includes((value ?? "").toLowerCase());
}

export function nativeClaimDebugEnabled(): boolean {
  return isEnabled(process.env.SPARK_NATIVE_CLAIM_DEBUG);
}

export function debugNativeClaim(label: string, value: unknown): void {
  if (!nativeClaimDebugEnabled()) return;
  console.log(`[spark-native-claim-debug] ${label}`);
  console.log(JSON.stringify(value, null, 2));
}

function maybeHex(value: unknown): string | undefined {
  return value instanceof Uint8Array ? hex(value) : undefined;
}

function maybeByteLength(value: unknown): number | undefined {
  return value instanceof Uint8Array ? value.length : undefined;
}

function maybeString(value: unknown): string | undefined {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function summarizeCommitment(commitment: SigningCommitment): {
  hiding: string;
  binding: string;
} {
  return {
    hiding: hex(commitment.hiding),
    binding: hex(commitment.binding),
  };
}

function summarizeOperatorCommitments(
  commitments: SignFrostParams["statechainCommitments"],
): Array<{ id: string; hiding: string; binding: string }> {
  return Object.entries(commitments ?? {}).map(([id, commitment]) => ({
    id,
    ...summarizeCommitment(commitment),
  }));
}

export function summarizeNativeTransfer(transfer: unknown): Record<string, unknown> {
  const transferRecord = asRecord(transfer);
  const leaves = Array.isArray(transferRecord.leaves)
    ? transferRecord.leaves
    : [];

  return {
    transferId: maybeString(transferRecord.id),
    senderIdentityPublicKey: maybeHex(transferRecord.senderIdentityPublicKey),
    leafCount: leaves.length,
    leaves: leaves.map((transferLeaf) => {
      const transferLeafRecord = asRecord(transferLeaf);
      const leaf = asRecord(transferLeafRecord.leaf);

      return {
        leafId: maybeString(leaf.id),
        status: maybeString(leaf.status),
        value: maybeString(leaf.value),
        verifyingPublicKey: maybeHex(leaf.verifyingPublicKey),
        nodeTxBytes: maybeByteLength(leaf.nodeTx),
        refundTxBytes: maybeByteLength(transferLeafRecord.intermediateRefundTx),
        directRefundTxBytes: maybeByteLength(
          transferLeafRecord.intermediateDirectRefundTx,
        ),
        directFromCpfpRefundTxBytes: maybeByteLength(
          transferLeafRecord.intermediateDirectFromCpfpRefundTx,
        ),
        secretCipherBytes: maybeByteLength(transferLeafRecord.secretCipher),
        senderSignatureHex: maybeHex(transferLeafRecord.signature),
        nativeOldKeyDerivation: {
          type: "ecies",
          pathBytes: maybeByteLength(transferLeafRecord.secretCipher),
          pathHex: maybeHex(transferLeafRecord.secretCipher),
        },
        nativeNewKeyDerivation: {
          type: "leaf",
          path: maybeString(leaf.id),
        },
      };
    }),
  };
}

export function installNativeFrostDebug(wallet: SparkWallet): void {
  if (!nativeClaimDebugEnabled()) return;

  const signer = (wallet as unknown as { config?: { signer?: SparkSigner } })
    .config?.signer;
  if (!signer) {
    debugNativeClaim("native signer unavailable", {});
    return;
  }

  const originalSignFrost = signer.signFrost.bind(signer);
  let index = 0;

  signer.signFrost = async (params: SignFrostParams): Promise<Uint8Array> => {
    const signatureShare = await originalSignFrost(params);
    index += 1;

    debugNativeClaim("frost sign", {
      index,
      keyDerivation: params.keyDerivation,
      messageHex: hex(params.message),
      publicKeyHex: hex(params.publicKey),
      verifyingKeyHex: hex(params.verifyingKey),
      operatorCommitments: summarizeOperatorCommitments(
        params.statechainCommitments,
      ),
      ...(params.adaptorPubKey && params.adaptorPubKey.length > 0
        ? { adaptorPublicKeyHex: hex(params.adaptorPubKey) }
        : {}),
      selfCommitment: summarizeCommitment(params.selfCommitment.commitment),
      signatureShareHex: hex(signatureShare),
    });

    return signatureShare;
  };

  debugNativeClaim("native frost debug installed", {
    signer: signer.constructor.name,
  });
}
