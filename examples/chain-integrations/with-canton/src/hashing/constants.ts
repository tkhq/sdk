/**
 * Hash purpose reserved for prepared transaction.
 * This constant is prepended to data before hashing to distinguish prepared transaction hashes.
 */
export const PREPARED_TRANSACTION_HASH_PURPOSE = Uint8Array.from([
  0x00, 0x00, 0x00, 0x30,
]);

export const NODE_TYPE_CREATE = Uint8Array.of(0x00);
export const NODE_TYPE_EXERCISE = Uint8Array.of(0x01);
export const NODE_TYPE_FETCH = Uint8Array.of(0x02);
export const NODE_TYPE_ROLLBACK = Uint8Array.of(0x03);
export const NODE_TYPE_QUERY_BY_KEY = Uint8Array.of(0x04);

export const VALUE_TYPE_UNIT = Uint8Array.of(0x00);
export const VALUE_TYPE_BOOL = Uint8Array.of(0x01);
export const VALUE_TYPE_INT64 = Uint8Array.of(0x02);
export const VALUE_TYPE_NUMERIC = Uint8Array.of(0x03);
export const VALUE_TYPE_TIMESTAMP = Uint8Array.of(0x04);
export const VALUE_TYPE_DATE = Uint8Array.of(0x05);
export const VALUE_TYPE_PARTY = Uint8Array.of(0x06);
export const VALUE_TYPE_TEXT = Uint8Array.of(0x07);
export const VALUE_TYPE_CONTRACT_ID = Uint8Array.of(0x08);
export const VALUE_TYPE_OPTIONAL = Uint8Array.of(0x09);
export const VALUE_TYPE_LIST = Uint8Array.of(0x0a);
export const VALUE_TYPE_TEXT_MAP = Uint8Array.of(0x0b);
export const VALUE_TYPE_RECORD = Uint8Array.of(0x0c);
export const VALUE_TYPE_VARIANT = Uint8Array.of(0x0d);
export const VALUE_TYPE_ENUM = Uint8Array.of(0x0e);
export const VALUE_TYPE_GEN_MAP = Uint8Array.of(0x0f);
