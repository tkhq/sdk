import type {
  DamlTransaction,
  DamlTransaction_Node,
  DamlTransaction_NodeSeed,
  Metadata,
  PreparedTransaction,
} from "@generated/proto/com/daml/ledger/api/v2/interactive/interactive_submission_service_pb";
import { sha256 } from "@noble/hashes/sha2";
import { encodeString, encodeRepeated } from "./primitive";
import { concat } from "./utils";
import type { Transform } from "./types";

/**
 * Function type that encodes a transaction node ID into its hash.
 */
export type HashNodeById = Transform<string>;

/**
 * Function type for encoding a transaction node with an optional seed and node hashing function.
 *
 * This function should not hash the node itself, just encode it.
 */
export type EncodeNode = (
  node: DamlTransaction_Node,
  seed: DamlTransaction_NodeSeed | undefined,
  hashNodeById: HashNodeById,
) => Uint8Array;

/**
 * Function type that creates an hashNodeById function from an encodeNode function.
 */
export type CreateHashNodeById = (
  nodes: DamlTransaction_Node[],
  nodeSeeds: DamlTransaction_NodeSeed[],
) => HashNodeById;

/**
 * Function type that encodes (but doesn't hash) a transaction into a Uint8Array.
 */
export type EncodeTransaction = Transform<DamlTransaction>;

/**
 * Function type that encodes (but doesn't hash) a metadata object into a Uint8Array.
 */
export type EncodeMetadata = Transform<Metadata>;

/**
 * Function type that encodes & hashes a metadata object and a purpose into a Uint8Array.
 */
export type HashMetadata = (
  metadata: Metadata,
  purpose: Uint8Array,
) => Uint8Array;

/**
 * Function type that encodes & hashes a transaction and a purpose into a Uint8Array.
 */
export type HashTransaction = (
  transaction: DamlTransaction,
  purpose: Uint8Array,
) => Uint8Array;

/**
 * Function type that hashes a prepared transaction object into a Uint8Array.
 */
export type HashPreparedTransaction = Transform<PreparedTransaction>;

export type GetNodeAndSeedByNodeId = (
  nodeId: string,
) => [node: DamlTransaction_Node, seed: DamlTransaction_NodeSeed | undefined];

/**
 * Creates an hashNodeById function that hashes transaction nodes.
 *
 * The function, when passed {@link EncodeNode} function, will return {@link CreateHashNodeById}
 * which in turn will create a {@link HashNodeById} function that can hash nodes by their ID.
 *
 * The reason for currying this is to be able to create a closure
 * over the transaction nodes and seeds, which are needed to encode the nodes, without having to pass them around.
 *
 * ```
 * // We need a version-specific encodeNode function which will encode (but not hash) a node
 * const encodeNodeV2 = () => { ... }
 *
 * // Then we can create a version-specific transaction encoding function
 * const createHashNodeByIdV2 = createHashNodeByIdFactory(encodeNodeV2);
 * const encodeTransactionV2 = createEncodeTransaction(createHashNodeByIdV2);
 * ```
 *
 * See {@link EncodeNode}
 * See {@link CreateHashNodeById}
 * See {@link createEncodeTransaction}
 */
export const createHashNodeByIdFactory =
  (encodeNode: EncodeNode): CreateHashNodeById =>
  (nodes, nodeSeeds) => {
    // Create a node lookup function
    const getNodeAndSeedByNodeId = createGetNodeAndSeedByNodeId(
      nodes,
      nodeSeeds,
    );

    // The resulting function allows for recursion by passing itself to the encodeNode function
    //
    // The reason behind this design is that transaction nodes can reference other nodes by their ID
    // (e.g., in the case of exercise nodes referencing their children),
    // so we need a way to encode a node that can also encode its referenced nodes.
    // By creating a closure over the nodes and seeds, we can easily access them when encoding any node.
    const hashNodeById: HashNodeById = (nodeId) =>
      sha256(encodeNode(...getNodeAndSeedByNodeId(nodeId), hashNodeById));

    return hashNodeById;
  };

/**
 * Creates a node-by-id getter function based on transaction nodes and node seeds
 */
const createGetNodeAndSeedByNodeId = (
  nodes: DamlTransaction_Node[],
  nodeSeeds: DamlTransaction_NodeSeed[],
): GetNodeAndSeedByNodeId => {
  // Create a quick lookup maps for nodes and seeds
  const nodesById = Object.fromEntries(nodes.map((n) => [n.nodeId, n]));
  const seedsByNodeId = Object.fromEntries(nodeSeeds.map((s) => [s.nodeId, s]));

  // Create a function that resolves a node ID to its corresponding node and seed, throwing an error if the node ID is unknown
  return (nodeId) => {
    const node = nodesById[nodeId];
    if (!node) {
      throw new Error(`Unknown node id ${nodeId}`);
    }

    const seed = seedsByNodeId[nodeId];
    return [node, seed];
  };
};

/**
 * Creates a transaction encoder function that encodes the version and roots of a transaction.
 *
 * See {@link createHashNodeByIdFactory} for an example
 */
export const createEncodeTransaction =
  (createHashNodeById: CreateHashNodeById): EncodeTransaction =>
  (transaction) => {
    const hashNodeById = createHashNodeById(
      transaction.nodes,
      transaction.nodeSeeds,
    );

    const version = encodeString(transaction.version);
    const roots = encodeRepeated(transaction.roots, hashNodeById);

    return concat(version, roots);
  };

export const createHashTransaction =
  (encodeTransaction: EncodeTransaction): HashTransaction =>
  (transaction, purpose) =>
    sha256(concat(purpose, encodeTransaction(transaction)));

export const createHashPreparedTransaction =
  (
    hashTransaction: HashTransaction,
    hashMetadata: HashMetadata,
    purpose: Uint8Array,
    hashingScheme: Uint8Array,
  ): HashPreparedTransaction =>
  (preparedTransaction) => {
    const transactionHash = hashTransaction(
      preparedTransaction.transaction!,
      purpose,
    );
    const metadataHash = hashMetadata(preparedTransaction.metadata!, purpose);

    return sha256(
      concat(purpose, hashingScheme, transactionHash, metadataHash),
    );
  };

export const createHashMetadata =
  (encodeMetadata: EncodeMetadata): HashMetadata =>
  (metadata, purpose) =>
    sha256(concat(purpose, encodeMetadata(metadata)));
