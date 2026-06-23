import {
  HashingSchemeVersion,
  type DamlTransaction_NodeSeed,
  type Metadata_InputContract,
} from "@generated/proto/com/daml/ledger/api/v2/interactive/interactive_submission_service_pb";
import type {
  Create,
  Exercise,
  Fetch,
  Rollback,
} from "@generated/proto/com/daml/ledger/api/v2/interactive/transaction/v1/interactive_submission_data_pb";
import {
  type EncodeNode,
  type HashNodeById,
  type HashPreparedTransaction,
  type EncodeMetadata,
  createHashNodeByIdFactory,
  createEncodeTransaction,
  createHashTransaction,
  createHashMetadata,
  createHashPreparedTransaction,
} from "./common";
import { sha256 } from "@noble/hashes/sha2";
import {
  encodeString,
  encodeOptional,
  encodeHash,
  encodeHexString,
  encodeRepeated,
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
  NODE_TYPE_ROLLBACK,
  PREPARED_TRANSACTION_HASH_PURPOSE,
} from "./constants";
import type { NodeType } from "./types";

/**
 * V2 hashing scheme version byte.
 */
const HASHING_SCHEME_VERSION = Uint8Array.of(HashingSchemeVersion.V2);

/**
 * Protobuf encoding version for transaction nodes in V2.
 */
const NODE_ENCODING_VERSION = Uint8Array.of(0x01);

const encodeNodeV2: EncodeNode = (node, seed, hashNodeById): Uint8Array => {
  switch (node.versionedNode?.case) {
    case "v1":
      return encodeNodeV1(
        node.versionedNode.value.nodeType,
        seed,
        hashNodeById,
      );
    default:
      throw new Error(`Unsupported node version ${node.versionedNode?.case}`);
  }
};

const createHashNodeByIdV2 = createHashNodeByIdFactory(encodeNodeV2);
const encodeTransactionV2 = createEncodeTransaction(createHashNodeByIdV2);
const hashTransactionV2 = createHashTransaction(encodeTransactionV2);

/**
 * Encodes transaction metadata including submitter info, timing, and input contracts.
 */
const encodeMetadataV2: EncodeMetadata = (metadata) =>
  concat(
    Uint8Array.of(0x01),
    encodeRepeated(metadata.submitterInfo!.actAs, encodeString),
    encodeString(metadata.submitterInfo!.commandId),
    encodeString(metadata.transactionUuid),
    encodeInt32(metadata.mediatorGroup),
    encodeString(metadata.synchronizerId),
    encodeOptional(metadata.minLedgerEffectiveTime, encodeInt64),
    encodeOptional(metadata.maxLedgerEffectiveTime, encodeInt64),
    encodeInt64(metadata.preparationTime),
    encodeRepeated(metadata.inputContracts, encodeInputContract),
  );

/**
 * Computes the hash of transaction metadata.
 */
const hashMetadataV2 = createHashMetadata(encodeMetadataV2);

/**
 * Computes the hash of a prepared transaction according to V2 hashing specification.
 */
export const hashPreparedTransactionV2: HashPreparedTransaction =
  createHashPreparedTransaction(
    hashTransactionV2,
    hashMetadataV2,
    PREPARED_TRANSACTION_HASH_PURPOSE,
    HASHING_SCHEME_VERSION,
  );

/**
 * Encodes a V1 transaction node based on its type (create, exercise, fetch, or rollback).
 *
 * See {@link NodeType}
 *
 * @throws {Error} If an exercise node is missing its seed
 */
const encodeNodeV1 = (
  node: NodeType,
  seed: DamlTransaction_NodeSeed | undefined,
  hashNodeById: HashNodeById,
): Uint8Array => {
  switch (node?.case) {
    case "create":
      return encodeCreateNode(node.value, seed);
    case "exercise":
      if (seed == null) {
        throw new Error(`Missing seed for exercise node`);
      }

      return encodeExerciseNode(node.value, seed, hashNodeById);
    case "fetch":
      return encodeFetchNode(node.value);
    case "rollback":
      return encodeRollbackNode(node.value, hashNodeById);
    default:
      throw new Error(`Unsupported node type ${node?.case}`);
  }
};

/**
 * Encodes a create node containing contract creation data.
 */
const encodeCreateNode = (
  create: Create,
  seed: DamlTransaction_NodeSeed | undefined,
): Uint8Array =>
  concat(
    NODE_ENCODING_VERSION,
    encodeString(create.lfVersion),
    NODE_TYPE_CREATE,
    encodeOptional(seed?.seed, encodeHash),
    encodeHexString(create.contractId),
    encodeString(create.packageName),
    encodeIdentifier(create.templateId!),
    encodeValue(create.argument!),
    encodeRepeated(create.signatories, encodeString),
    encodeRepeated(create.stakeholders, encodeString),
  );

/**
 * Encodes an exercise node containing contract choice execution data.
 */
const encodeExerciseNode = (
  exercise: Exercise,
  seed: DamlTransaction_NodeSeed,
  hashNodeById: HashNodeById,
): Uint8Array => {
  return concat(
    NODE_ENCODING_VERSION,
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
    encodeRepeated(exercise.children, hashNodeById),
  );
};

/**
 * Encodes a fetch node containing contract fetch data.
 */
const encodeFetchNode = (fetch: Fetch): Uint8Array =>
  concat(
    NODE_ENCODING_VERSION,
    encodeString(fetch.lfVersion),
    NODE_TYPE_FETCH,
    encodeHexString(fetch.contractId),
    encodeString(fetch.packageName),
    encodeIdentifier(fetch.templateId!),
    encodeRepeated(fetch.signatories, encodeString),
    encodeRepeated(fetch.stakeholders, encodeString),
    encodeOptional(fetch.interfaceId, encodeIdentifier),
    encodeRepeated(fetch.actingParties, encodeString),
  );

/**
 * Encodes a rollback node containing child node IDs that were rolled back.
 */
const encodeRollbackNode = (
  rollback: Rollback,
  hashNodeById: HashNodeById,
): Uint8Array =>
  concat(
    NODE_ENCODING_VERSION,
    NODE_TYPE_ROLLBACK,
    encodeRepeated(rollback.children, hashNodeById),
  );

/**
 * Encodes an input contract with its creation time and contract data.
 *
 * @throws {Error} If the contract version is unsupported
 */
const encodeInputContract = (contract: Metadata_InputContract): Uint8Array => {
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
