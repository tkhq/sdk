/**
 * TurnkeySparkSigner — implements the SparkSigner interface, delegating all
 * signing and key operations to Turnkey.
 *
 * Authentication (identity key operations):
 *   - getIdentityPublicKey()
 *   - signMessageWithIdentityKey()   ← ECDSA/Schnorr, used for SO auth
 *   - signSchnorrWithIdentityKey()   ← Schnorr, used for token operations
 *
 * FROST signing (via SPARK_PREPARE_AND_SIGN activity):
 *   - getRandomSigningCommitment()   ← returns mutable placeholder
 *   - signFrost()                    ← calls Turnkey, mutates commitment
 *   - aggregateFrost()               ← client-side signature aggregation
 *
 * Key operations (via SPARK_PREPARE_AND_SIGN with package_request):
 *   - subtractSplitAndEncrypt()      ← deferred, executed inside signFrost
 *
 * Key operations (via SPARK_KEY_OPERATION activity):
 *   - getPublicKeyFromDerivation()   ← derive public key at any SparkKeyType path
 *   - getDepositSigningKey()         ← derive DEPOSIT public key
 *   - decryptEcies()                 ← ECIES decrypt using identity key
 *
 * ## Deferred Commitment Pattern
 *
 * The Spark SDK generates user nonce commitments before signing (getRandomSigningCommitment),
 * but Turnkey's PREPARE_AND_SIGN generates the nonce and signs in one call. We bridge this
 * by returning a mutable placeholder from getRandomSigningCommitment, then mutating it with
 * Turnkey's real commitment values inside signFrost. The SDK holds the same object reference,
 * so it picks up the real values when building the transfer package.
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { mnemonicToSeed } from "@scure/bip39";
import {
  KeyDerivationType,
  getSparkFrost,
  type SparkSigner,
  type SignFrostParams,
  type AggregateFrostParams,
  type SigningCommitmentWithOptionalNonce,
  type SigningCommitment,
  type KeyDerivation,
  type SplitSecretWithProofsParams,
  type SubtractSplitAndEncryptParams,
  type SubtractSplitAndEncryptResult,
  type VerifiableSecretShare,
  type SigningNonce,
} from "@buildonspark/spark-sdk";
import type { Transaction } from "@scure/btc-signer";
import type { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function fromHex(h: string): Uint8Array {
  return Buffer.from(h.replace(/^0x/, ""), "hex");
}

function notImplemented(method: string): never {
  throw new Error(
    `TurnkeySparkSigner.${method} is not yet implemented. ` +
      `This method requires functionality not yet available via Turnkey activities.`,
  );
}

/** Maps SDK KeyDerivation to the proto SparkKeyDerivation shape. */
function mapKeyDerivation(kd: KeyDerivation): Record<string, unknown> {
  switch (kd.type) {
    case "leaf":
      return { sparkKeyType: "SPARK_KEY_TYPE_SIGNING_HD", leafId: kd.path };
    case "deposit":
      return { sparkKeyType: "SPARK_KEY_TYPE_DEPOSIT" };
    case "static_deposit":
      return {
        sparkKeyType: "SPARK_KEY_TYPE_STATIC_DEPOSIT_HD",
        childIndex: kd.path,
      };
    default:
      throw new Error(`Unsupported key derivation type: ${kd.type}`);
  }
}

/** Maps operator commitment map to proto shape. */
function mapOperatorCommitments(
  commitments: { [key: string]: SigningCommitment } | undefined,
): Array<{ id: string; hiding: string; binding: string }> {
  if (!commitments) return [];
  return Object.entries(commitments).map(([id, c]) => ({
    id,
    hiding: hex(c.hiding),
    binding: hex(c.binding),
  }));
}

/**
 * Result shape from Turnkey's SPARK_PREPARE_AND_SIGN activity.
 * This mirrors SparkPrepareAndSignResult from activity.proto.
 */
interface PrepareAndSignResult {
  signatures: Array<{
    signatureShare: string;
    hiding: string;
    binding: string;
  }>;
  operatorPackages?: Array<Record<string, unknown>>;
  paymentHash?: string;
  transferUserSignature?: string;
}

/**
 * Result shape from Turnkey's SPARK_KEY_OPERATION activity.
 * This mirrors SparkKeyOperationResult from activity.proto.
 */
interface KeyOperationResult {
  publicKeys?: Array<{ publicKey: string }>;
  decryptedData?: Array<{ plaintext: string }>;
}

export class TurnkeySparkSigner implements SparkSigner {
  private readonly client: TurnkeyServerSDK;
  /** The Turnkey address used for the Spark wallet (sign_with) */
  private readonly sparkWalletAddress: string;
  /** Compressed 33-byte public key (02/03 prefix) */
  private readonly identityPublicKeyHex: string;

  /**
   * Pending key tweak from subtractSplitAndEncrypt, consumed by the next
   * signFrost call via PREPARE_AND_SIGN's package_request.
   */
  private pendingKeyTweak: SubtractSplitAndEncryptParams | null = null;
  private pendingKeyTweakResult: SubtractSplitAndEncryptResult | null = null;

  constructor(
    client: TurnkeyServerSDK,
    sparkWalletAddress: string,
    identityPublicKeyHex: string,
  ) {
    this.client = client;
    this.sparkWalletAddress = sparkWalletAddress;
    this.identityPublicKeyHex = identityPublicKeyHex;
  }

  // ---------------------------------------------------------------------------
  // Identity key operations (already working)
  // ---------------------------------------------------------------------------

  getIdentityPublicKey(): Promise<Uint8Array> {
    return Promise.resolve(Buffer.from(this.identityPublicKeyHex, "hex"));
  }

  async signMessageWithIdentityKey(
    message: Uint8Array,
    _compact?: boolean,
  ): Promise<Uint8Array> {
    const { r, s } = await this.client.apiClient().signRawPayload({
      signWith: this.sparkWalletAddress,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
      payload: hex(message),
    });

    const rPadded = r.padStart(64, "0");
    const sPadded = s.padStart(64, "0");
    return Buffer.from(rPadded + sPadded, "hex");
  }

  async signSchnorrWithIdentityKey(message: Uint8Array): Promise<Uint8Array> {
    const { r, s } = await this.client.apiClient().signRawPayload({
      signWith: this.sparkWalletAddress,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
      payload: hex(message),
    });

    const rPadded = r.padStart(64, "0");
    const sPadded = s.padStart(64, "0");
    return Buffer.from(rPadded + sPadded, "hex");
  }

  async validateMessageWithIdentityKey(
    message: Uint8Array,
    signature: Uint8Array,
  ): Promise<boolean> {
    const pubKey = await this.getIdentityPublicKey();
    return secp256k1.verify(signature, message, pubKey);
  }

  async mnemonicToSeed(mnemonic: string): Promise<Uint8Array> {
    return mnemonicToSeed(mnemonic);
  }

  async createSparkWalletFromSeed(
    _seed: Uint8Array | string,
    _accountNumber?: number,
  ): Promise<string> {
    return this.identityPublicKeyHex;
  }

  // ---------------------------------------------------------------------------
  // FROST signing — bridges to SPARK_PREPARE_AND_SIGN
  // ---------------------------------------------------------------------------

  /**
   * Returns a mutable placeholder commitment. The real commitment values are
   * populated by signFrost() when Turnkey's PREPARE_AND_SIGN returns.
   *
   * The SDK holds a reference to this object and reads commitment.hiding/binding
   * AFTER signFrost() completes, so the mutation propagates correctly.
   */
  async getRandomSigningCommitment(): Promise<SigningCommitmentWithOptionalNonce> {
    const placeholder: SigningCommitmentWithOptionalNonce = {
      commitment: {
        hiding: new Uint8Array(33),
        binding: new Uint8Array(33),
      },
    };
    return placeholder;
  }

  /**
   * Nonce is not available client-side — Turnkey generates it internally.
   * Returns undefined, which the SDK handles gracefully (the nonce is only
   * needed by the local signer implementation, not by the coordinator).
   */
  getNonceForSelfCommitment(
    _selfCommitment: SigningCommitmentWithOptionalNonce,
  ): SigningNonce | undefined {
    return undefined;
  }

  /**
   * Calls Turnkey's SPARK_PREPARE_AND_SIGN activity. Generates nonce, signs,
   * and returns the partial signature. Mutates params.selfCommitment with the
   * real (hiding, binding) values from Turnkey.
   *
   * If subtractSplitAndEncrypt() was called before this, includes the pending
   * key tweak as a package_request in the same activity call.
   */
  async signFrost(params: SignFrostParams): Promise<Uint8Array> {
    const signatureRequest = {
      derivation: mapKeyDerivation(params.keyDerivation),
      message: hex(params.message),
      verifyingKey: hex(params.verifyingKey),
      operatorCommitments: mapOperatorCommitments(
        params.statechainCommitments,
      ),
      ...(params.adaptorPubKey
        ? { adaptorPublicKey: hex(params.adaptorPubKey) }
        : {}),
    };

    // Build the activity intent
    const intent: Record<string, unknown> = {
      signWith: this.sparkWalletAddress,
      signatures: [signatureRequest],
    };

    // If there's a pending key tweak from subtractSplitAndEncrypt, include it
    // as a transfer package request
    if (this.pendingKeyTweak) {
      intent.packageRequest = {
        transfer: {
          receiverIdentityPublicKey: hex(
            this.pendingKeyTweak.receiverPublicKey,
          ),
          threshold: this.pendingKeyTweak.threshold,
          numShares: this.pendingKeyTweak.numShares,
          firstDerivation: mapKeyDerivation(this.pendingKeyTweak.first),
          secondDerivation: mapKeyDerivation(this.pendingKeyTweak.second),
        },
      };
    }

    const result = await this.callPrepareAndSign(intent);

    // Mutate the commitment placeholder with Turnkey's real values
    const sig = result.signatures[0]!;
    const commitment = params.selfCommitment.commitment;
    commitment.hiding = fromHex(sig.hiding);
    commitment.binding = fromHex(sig.binding);

    // Populate the deferred key tweak result if present
    if (this.pendingKeyTweakResult && result.operatorPackages) {
      // The enclave returns operator packages with the shares and cipher
      // Map them back to the SDK's expected shape
      Object.assign(this.pendingKeyTweakResult, {
        shares: result.operatorPackages,
        secretCipher: result.transferUserSignature
          ? fromHex(result.transferUserSignature)
          : new Uint8Array(),
      });
    }

    // Clear pending state
    this.pendingKeyTweak = null;
    this.pendingKeyTweakResult = null;

    return fromHex(sig.signatureShare);
  }

  async aggregateFrost(params: AggregateFrostParams): Promise<Uint8Array> {
    const sparkFrost = getSparkFrost();
    return sparkFrost.aggregateFrost({
      message: params.message,
      statechainSignatures: params.statechainSignatures,
      statechainPublicKeys: params.statechainPublicKeys,
      verifyingKey: params.verifyingKey,
      statechainCommitments: params.statechainCommitments,
      selfCommitment: params.selfCommitment.commitment,
      selfPublicKey: params.publicKey,
      selfSignature: params.selfSignature,
      adaptorPubKey: params.adaptorPubKey,
    });
  }

  // ---------------------------------------------------------------------------
  // Key operations
  // ---------------------------------------------------------------------------

  /**
   * Deferred key tweak for transfers. Stores params and returns a mutable
   * placeholder. The actual computation happens inside the next signFrost()
   * call via PREPARE_AND_SIGN's package_request.
   */
  async subtractSplitAndEncrypt(
    params: SubtractSplitAndEncryptParams,
  ): Promise<SubtractSplitAndEncryptResult> {
    this.pendingKeyTweak = params;

    const placeholder: SubtractSplitAndEncryptResult = {
      shares: [] as unknown as VerifiableSecretShare[],
      secretCipher: new Uint8Array(),
    };
    this.pendingKeyTweakResult = placeholder;
    return placeholder;
  }

  async getPublicKeyFromDerivation(
    keyDerivation?: KeyDerivation,
  ): Promise<Uint8Array> {
    if (!keyDerivation) {
      return this.getIdentityPublicKey();
    }

    const result = await this.callSparkKeyOperation({
      signWith: this.sparkWalletAddress,
      derivePublicKeys: [{ derivation: mapKeyDerivation(keyDerivation) }],
    });

    const pk = result.publicKeys?.[0]?.publicKey;
    if (!pk) {
      throw new Error("SPARK_KEY_OPERATION returned no public key");
    }
    return fromHex(pk);
  }

  async getDepositSigningKey(): Promise<Uint8Array> {
    return this.getPublicKeyFromDerivation({
      type: KeyDerivationType.DEPOSIT,
    });
  }

  async getStaticDepositSigningKey(idx: number): Promise<Uint8Array> {
    return this.getPublicKeyFromDerivation({
      type: KeyDerivationType.STATIC_DEPOSIT,
      path: idx,
    });
  }

  async getStaticDepositSecretKey(_idx: number): Promise<Uint8Array> {
    return notImplemented("getStaticDepositSecretKey");
  }

  async decryptEcies(ciphertext: Uint8Array): Promise<Uint8Array> {
    const result = await this.callSparkKeyOperation({
      signWith: this.sparkWalletAddress,
      decryptEciesRequests: [{ ciphertext: hex(ciphertext) }],
    });

    const data = result.decryptedData?.[0]?.plaintext;
    if (!data) {
      throw new Error("SPARK_KEY_OPERATION returned no decrypted data");
    }
    return fromHex(data);
  }

  // ---------------------------------------------------------------------------
  // Not needed for Turnkey-backed wallets
  // ---------------------------------------------------------------------------

  async generateMnemonic(): Promise<string> {
    return notImplemented("generateMnemonic");
  }

  async subtractPrivateKeysGivenDerivationPaths(
    _first: string,
    _second: string,
  ): Promise<Uint8Array> {
    return notImplemented("subtractPrivateKeysGivenDerivationPaths");
  }

  async subtractAndSplitSecretWithProofsGivenDerivations(
    _params: Omit<SplitSecretWithProofsParams, "secret"> & {
      first: KeyDerivation;
      second?: KeyDerivation | undefined;
    },
  ): Promise<VerifiableSecretShare[]> {
    return notImplemented("subtractAndSplitSecretWithProofsGivenDerivations");
  }

  async splitSecretWithProofs(
    _params: SplitSecretWithProofsParams,
  ): Promise<VerifiableSecretShare[]> {
    return notImplemented("splitSecretWithProofs");
  }

  signTransactionIndex(
    _tx: Transaction,
    _index: number,
    _publicKey: Uint8Array,
  ): void {
    notImplemented("signTransactionIndex");
  }

  async htlcHMAC(_transferID: string): Promise<Uint8Array> {
    return notImplemented("htlcHMAC");
  }

  // ---------------------------------------------------------------------------
  // Internal: Turnkey activity call
  // ---------------------------------------------------------------------------

  /**
   * Calls Turnkey's SPARK_PREPARE_AND_SIGN activity via the raw command API.
   *
   * The Turnkey SDK doesn't have a typed method for this activity yet —
   * once it's added to the OpenAPI spec and SDK codegen, replace this with
   * the typed `client.apiClient().sparkPrepareAndSign(...)` call.
   */
  private async callPrepareAndSign(
    intent: Record<string, unknown>,
  ): Promise<PrepareAndSignResult> {
    const apiClient = this.client.apiClient() as unknown as {
      command<B, R>(url: string, body: B, resultKey: string): Promise<R>;
      config: { organizationId?: string };
    };

    return apiClient.command<Record<string, unknown>, PrepareAndSignResult>(
      "/public/v1/submit/spark_prepare_and_sign",
      {
        parameters: intent,
        organizationId: apiClient.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_SPARK_PREPARE_AND_SIGN",
      },
      "sparkPrepareAndSignResult",
    );
  }

  private async callSparkKeyOperation(
    intent: Record<string, unknown>,
  ): Promise<KeyOperationResult> {
    const apiClient = this.client.apiClient() as unknown as {
      command<B, R>(url: string, body: B, resultKey: string): Promise<R>;
      config: { organizationId?: string };
    };

    return apiClient.command<Record<string, unknown>, KeyOperationResult>(
      "/public/v1/submit/spark_key_operation",
      {
        parameters: intent,
        organizationId: apiClient.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_SPARK_KEY_OPERATION",
      },
      "sparkKeyOperationResult",
    );
  }
}
