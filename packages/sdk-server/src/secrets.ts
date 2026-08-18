import type {
  TActivityStatus,
  v1Pagination,
  v1TransportEncryptionSuite,
} from "@turnkey/sdk-types";

/**
 * SDK-level parameter/result types for the Secrets API convenience methods.
 * The wire types (requests, intents, results) are the generated ones in
 * `@turnkey/sdk-types` (`v1ExportSecretsRequest`, `v1ImportSecretParams`,
 * `v1ExportSecretsResult`, ...); the types here only shape the higher-level
 * flows composed on top of them.
 */

export const TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V1 =
  "TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V1" satisfies v1TransportEncryptionSuite;

export type ImportSecretParams = {
  /** Secret material to import. */
  plaintext: string;
  /** Optional human-readable name. Names are unique within an organization. */
  name?: string;
  /** Policy-visible static properties bound immutably to the secret at creation. */
  staticProperties?: Record<string, string>;
  organizationId?: string;
  /** Override the signer public key used to verify enclave bundles. Testing only. */
  dangerouslyOverrideSignerPublicKey?: string;
};

export type GetSecretsParams = {
  organizationId?: string;
  /** Cursor-based pagination. Passed through to `listSecrets` unchanged. */
  paginationOptions?: v1Pagination;
};

/**
 * `v1SecretMetadata` with `staticProperties` as a plain object, matching the
 * shape `importSecret` accepts.
 */
export type SecretMetadata = {
  secretId: string;
  name?: string;
  staticProperties: Record<string, string>;
  /** Unix timestamp in milliseconds for when the secret was created. */
  createdAtUnixMs: string;
};

export type ExportSecretParams = {
  secretId: string;
  organizationId?: string;
  /** How long to wait for the activity to reach a terminal status. Defaults to 60s. */
  timeoutMs?: number;
  /** Defaults to 500ms. */
  pollingIntervalMs?: number;
  /** Override the signer public key used to verify enclave bundles. Testing only. */
  dangerouslyOverrideSignerPublicKey?: string;
};

export type CreateExportSecretsProposalParams = {
  secrets: { secretId: string }[];
  /** Recipient's ephemeral P-256 public key (compressed hex). Only the holder of the private half can decrypt the export. */
  targetPublicKey: string;
  organizationId?: string;
  /** Defaults to now. Part of the signed bytes: all co-signers share this value. */
  timestampMs?: string;
};

export type ExportSecretsProposal = {
  /**
   * Canonical serialized ExportSecretsRequest. Opaque: submitted
   * byte-for-byte by every co-signer, never re-serialized. Safe to ship
   * between agents as JSON — it contains no key material.
   */
  body: string;
  /** "sha256:<hex>" over `body` — equal to the server-side activity fingerprint. */
  fingerprint: string;
  organizationId: string;
  targetPublicKey: string;
};

export type SubmitExportSecretsResult = {
  activityId: string;
  fingerprint: string;
  status: TActivityStatus;
  /** Present when the activity completed with this submission. */
  secretPayloads?: string[];
};

export type AwaitExportedSecretsParams = {
  proposal: ExportSecretsProposal;
  /** The hex-encoded ephemeral private key the proposal targets (e.g. from generateP256KeyPair). */
  embeddedPrivateKey: string;
  timeoutMs?: number;
  pollingIntervalMs?: number;
  /** Override the signer public key used to verify enclave bundles. Testing only. */
  dangerouslyOverrideSignerPublicKey?: string;
};
