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
 * ## Deferred Commitment Pattern
 *
 * The Spark SDK generates user nonce commitments before signing (getRandomSigningCommitment),
 * but Turnkey's PREPARE_AND_SIGN generates the nonce and signs in one call. We bridge this
 * by returning a mutable placeholder from getRandomSigningCommitment, then mutating it with
 * Turnkey's real commitment values inside signFrost. The SDK holds the same object reference,
 * so it picks up the real values when building the transfer package.
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { schnorr } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { mnemonicToSeed } from "@scure/bip39";
import type {
  SparkSigner,
  SignFrostParams,
  AggregateFrostParams,
  SigningCommitmentWithOptionalNonce,
  SigningCommitment,
  KeyDerivation,
  SplitSecretWithProofsParams,
  SubtractSplitAndEncryptParams,
  SubtractSplitAndEncryptResult,
  VerifiableSecretShare,
  SigningNonce,
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

  /**
   * Aggregates FROST partial signatures into a final BIP-340 Schnorr signature.
   *
   * This is purely computational — no private keys involved. The aggregator
   * sums partial signatures and computes the group nonce from all commitments.
   *
   * TODO: Import the spark-frost WASM module for production use. The sketch
   * below shows the mathematical operation; the actual implementation should
   * use the same FROST library the Spark SDK uses internally.
   */
  async aggregateFrost(params: AggregateFrostParams): Promise<Uint8Array> {
    // Collect all commitments: self + operators
    const allCommitments = new Map<string, SigningCommitment>();
    allCommitments.set("self", params.selfCommitment.commitment);
    if (params.statechainCommitments) {
      for (const [id, c] of Object.entries(params.statechainCommitments)) {
        allCommitments.set(id, c);
      }
    }

    // Collect all partial signatures: self + operators
    const allSignatures = new Map<string, Uint8Array>();
    allSignatures.set("self", params.selfSignature);
    if (params.statechainSignatures) {
      for (const [id, sig] of Object.entries(params.statechainSignatures)) {
        allSignatures.set(id, sig);
      }
    }

    // FROST aggregation: sum partial signatures mod curve order
    // R = sum(D_i + rho_i * E_i) for all participants
    // s = sum(s_i) mod n
    //
    // The binding factor rho_i = H("frost_binding", i || msg || encoded_commitments)
    // Computing this correctly requires the same FROST implementation the
    // Spark SDK uses. For now, delegate to the spark-frost WASM module.
    //
    // TODO: Replace with actual FROST aggregation call.
    // The spark-sdk's DefaultSigner uses getSparkFrost().aggregateFrost({...})
    // which is a WASM binding. We need to either:
    //   1. Import @buildonspark/spark-frost-wasm directly
    //   2. Re-export aggregateFrost from spark-sdk
    //   3. Implement FROST aggregation with @noble/curves
    throw new Error(
      "aggregateFrost: needs spark-frost WASM module. " +
        "See TODO in TurnkeySparkSigner for implementation options.",
    );
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

    // For key types that map to Turnkey wallet accounts, derive via
    // the Spark wallet's BIP32 path. The Turnkey wallet created with
    // ADDRESS_FORMAT_SPARK_* should have accounts for each key type.
    //
    // TODO: Use Turnkey's getWalletAccount or createWalletAccounts
    // to retrieve the public key at the appropriate BIP32 derivation path.
    return notImplemented("getPublicKeyFromDerivation");
  }

  async getDepositSigningKey(): Promise<Uint8Array> {
    // BIP32 path: m/8797555'/A'/2' (DEPOSIT key type)
    // TODO: Retrieve from Turnkey wallet account at DEPOSIT path
    return notImplemented("getDepositSigningKey");
  }

  async getStaticDepositSigningKey(_idx: number): Promise<Uint8Array> {
    return notImplemented("getStaticDepositSigningKey");
  }

  async getStaticDepositSecretKey(_idx: number): Promise<Uint8Array> {
    return notImplemented("getStaticDepositSecretKey");
  }

  async decryptEcies(_ciphertext: Uint8Array): Promise<Uint8Array> {
    // Needed for receiving transfers (decrypting the key tweak cipher).
    // Requires a new Turnkey activity or extension to PREPARE_AND_SIGN.
    return notImplemented("decryptEcies");
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
}
