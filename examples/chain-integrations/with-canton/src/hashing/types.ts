import type { Node } from "@generated/proto/com/daml/ledger/api/v2/interactive/transaction/v1/interactive_submission_data_pb";

/**
 * V1 Transaction node subtype.
 */
export type NodeType = Node["nodeType"];

/**
 * Function type for transforming values into Uint8Array format.
 */
export type Transform<T> = (value: T) => Uint8Array;
