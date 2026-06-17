import type { GlobalKeyWithMaintainers } from "@generated/proto/com/daml/ledger/api/v2/interactive/interactive_submission_common_data_pb";
import type {
  DamlTransaction_NodeSeed,
  Metadata_InputContract,
} from "@generated/proto/com/daml/ledger/api/v2/interactive/interactive_submission_service_pb";
import type {
  Create,
  Exercise,
  Fetch,
  Node,
  QueryByKey,
  Rollback,
} from "@generated/proto/com/daml/ledger/api/v2/interactive/transaction/v1/interactive_submission_data_pb";
import {
  type EncodeMetadata,
  type EncodeNode,
  type HashNodeById,
  type HashPreparedTransaction,
  createHashNodeByIdFactory,
  createEncodeTransaction,
  createHashTransaction,
  createHashMetadata,
  createHashPreparedTransaction,
} from "./common";
import { sha256 } from "@noble/hashes/sha2";
import {
  encodeString,
  encodeHash,
  encodeRepeated,
  encodeOptional,
  encodeHexString,
  encodeBool,
  encodeInt32,
  encodeInt64,
} from "./primitive";
import { encodeIdentifier, encodeValue } from "./proto";
import { concat } from "./utils";
import {
  NODE_TYPE_CREATE,
  NODE_TYPE_EXERCISE,
  NODE_TYPE_FETCH,
  NODE_TYPE_QUERY_BY_KEY,
  NODE_TYPE_ROLLBACK,
  PREPARED_TRANSACTION_HASH_PURPOSE,
} from "./constants";

/**
 * V3 hashing scheme version byte.
 */
export const HASHING_SCHEME_VERSION = Uint8Array.of(0x03);

/**
 * Encodes a transaction node (V3 version).
 */
export const encodeNode: EncodeNode = (
  node,
  seed,
  hashNodeById,
): Uint8Array => {
  switch (node.versionedNode?.case) {
    case "v1":
      return encodeNodeTypeV1(
        node.versionedNode.value.nodeType,
        seed,
        hashNodeById,
      );
    default:
      throw new Error(`Unsupported node version ${node.versionedNode?.case}`);
  }
};

const createHashNodeByIdV3 = createHashNodeByIdFactory(encodeNode);
const encodeTransactionV3 = createEncodeTransaction(createHashNodeByIdV3);
const hashTransactionV3 = createHashTransaction(encodeTransactionV3);

/**
 * Encodes transaction metadata including max_record_time (V3 specific).
 * @param metadata - The Metadata to encode
 * @returns The encoded metadata as Uint8Array
 */
export const encodeMetadataV3: EncodeMetadata = (metadata) =>
  concat(
    encodeRepeated(metadata.submitterInfo!.actAs, encodeString),
    encodeString(metadata.submitterInfo!.commandId),
    encodeString(metadata.transactionUuid),
    encodeInt32(metadata.mediatorGroup),
    encodeString(metadata.synchronizerId),
    encodeOptional(metadata.minLedgerEffectiveTime, encodeInt64),
    encodeOptional(metadata.maxLedgerEffectiveTime, encodeInt64),
    encodeInt64(metadata.preparationTime),
    encodeRepeated(metadata.inputContracts, encodeInputContract),
    encodeOptional(metadata.maxRecordTime, encodeInt64),
  );

/**
 * Computes the hash of transaction metadata.
 */
export const hashMetadataV3 = createHashMetadata(encodeMetadataV3);

/**
 * Computes the hash of a prepared transaction according to V3 hashing specification.
 */
export const hashPreparedTransactionV3: HashPreparedTransaction =
  createHashPreparedTransaction(
    hashTransactionV3,
    hashMetadataV3,
    PREPARED_TRANSACTION_HASH_PURPOSE,
    HASHING_SCHEME_VERSION,
  );

/**
 * Encodes a global key with maintainers.
 * @param keyWithMaintainers - The key data including package name, template ID, key value, and maintainers
 * @returns The encoded key with maintainers as Uint8Array
 */
export const encodeKeyWithMaintainers = (
  keyWithMaintainers: GlobalKeyWithMaintainers,
): Uint8Array =>
  concat(
    encodeString(keyWithMaintainers.key!.packageName),
    encodeIdentifier(keyWithMaintainers.key!.templateId!),
    encodeValue(keyWithMaintainers.key!.key!),
    encodeHash(keyWithMaintainers.key!.hash),
    encodeRepeated(keyWithMaintainers.maintainers, encodeString),
  );

/**
 * Encodes a V1 transaction node subtype based on its type (create, exercise, fetch, rollback, or queryByKey).
 *
 * @throws {Error} If an exercise node is missing its seed
 */
export const encodeNodeTypeV1 = (
  nodeType: Node["nodeType"],
  seed: DamlTransaction_NodeSeed | undefined,
  hashNodeById: HashNodeById,
): Uint8Array => {
  switch (nodeType?.case) {
    case "create":
      return encodeCreateNode(nodeType.value, seed);
    case "exercise":
      if (seed == null) {
        throw new Error(`Missing seed for exercise node`);
      }

      return encodeExerciseNode(nodeType.value, seed, hashNodeById);
    case "fetch":
      return encodeFetchNode(nodeType.value);
    case "rollback":
      return encodeRollbackNode(nodeType.value, hashNodeById);
    case "queryByKey":
      return encodeQueryByKeyNode(nodeType.value);
    default:
      throw new Error(`Unsupported node type ${nodeType?.case}`);
  }
};

/**
 * Encodes a create node containing contract creation data with optional key.
 */
export const encodeCreateNode = (
  create: Create,
  seed: DamlTransaction_NodeSeed | undefined,
): Uint8Array =>
  concat(
    encodeString(create.lfVersion),
    NODE_TYPE_CREATE,
    encodeOptional(seed?.seed, encodeHash),
    encodeHexString(create.contractId),
    encodeString(create.packageName),
    encodeIdentifier(create.templateId!),
    encodeValue(create.argument!),
    encodeRepeated(create.signatories, encodeString),
    encodeRepeated(create.stakeholders, encodeString),
    encodeOptional(create.key, encodeKeyWithMaintainers),
  );

/**
 * Encodes an exercise node containing contract choice execution data with byKey flag.
 */
export const encodeExerciseNode = (
  exercise: Exercise,
  seed: DamlTransaction_NodeSeed,
  hashNodeById: HashNodeById,
): Uint8Array => {
  return concat(
    encodeString(exercise.lfVersion),
    NODE_TYPE_EXERCISE,
    encodeHash(seed.seed),
    encodeHexString(exercise.contractId),
    encodeString(exercise.packageName),
    encodeIdentifier(exercise.templateId!),
    encodeRepeated(exercise.signatories, encodeString),
    encodeRepeated(exercise.stakeholders, encodeString),
    encodeRepeated(exercise.actingParties, encodeString),
    encodeOptional(exercise.interfaceId, encodeIdentifier),
    encodeString(exercise.choiceId),
    encodeValue(exercise.chosenValue!),
    encodeBool(exercise.consuming),
    encodeOptional(exercise.exerciseResult, encodeValue),
    encodeRepeated(exercise.choiceObservers, encodeString),
    encodeBool(Boolean(exercise.byKey)),
    encodeOptional(exercise.key, encodeKeyWithMaintainers),
    encodeRepeated(exercise.children, hashNodeById),
  );
};

/**
 * Encodes a fetch node containing contract fetch data with byKey flag.
 */
export const encodeFetchNode = (fetch: Fetch): Uint8Array =>
  concat(
    encodeString(fetch.lfVersion),
    NODE_TYPE_FETCH,
    encodeHexString(fetch.contractId),
    encodeString(fetch.packageName),
    encodeIdentifier(fetch.templateId!),
    encodeRepeated(fetch.signatories, encodeString),
    encodeRepeated(fetch.stakeholders, encodeString),
    encodeOptional(fetch.interfaceId, encodeIdentifier),
    encodeRepeated(fetch.actingParties, encodeString),
    encodeBool(Boolean(fetch.byKey)),
    encodeOptional(fetch.key, encodeKeyWithMaintainers),
  );

/**
 * Encodes a rollback node containing child node IDs that were rolled back.
 * @param rollback - The Rollback node data
 * @param hashNodeById - Function to encode child node IDs
 * @returns The encoded rollback node as Uint8Array
 */
export const encodeRollbackNode = (
  rollback: Rollback,
  hashNodeById: HashNodeById,
): Uint8Array =>
  concat(NODE_TYPE_ROLLBACK, encodeRepeated(rollback.children, hashNodeById));

/**
 * Encodes a query-by-key node containing template and key lookup information.
 * @param queryByKey - The QueryByKey node data
 * @returns The encoded query-by-key node as Uint8Array
 */
export const encodeQueryByKeyNode = (queryByKey: QueryByKey): Uint8Array =>
  concat(
    encodeString(queryByKey.lfVersion),
    NODE_TYPE_QUERY_BY_KEY,
    encodeString(queryByKey.packageName),
    encodeIdentifier(queryByKey.templateId!),
    encodeBool(queryByKey.exhaustive),
    encodeKeyWithMaintainers(queryByKey.key!),
    encodeRepeated(queryByKey.result, encodeHexString),
  );

/**
 * Encodes an input contract with its creation time and contract data.
 *
 * @throws {Error} If the contract version is unsupported
 */
export const encodeInputContract = (
  contract: Metadata_InputContract,
): Uint8Array => {
  const createdAtBytes = encodeInt64(contract.createdAt);
  let contractBytes: Uint8Array;

  switch (contract.contract?.case) {
    case "v1":
      contractBytes = encodeCreateNode(contract.contract.value, undefined);
      break;

    default:
      throw new Error(
        `Unsupported contract version ${contract.contract?.case}`,
      );
  }

  return concat(createdAtBytes, sha256(contractBytes));
};
