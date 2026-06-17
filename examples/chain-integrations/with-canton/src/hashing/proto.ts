import type {
  GenMap_Entry,
  Identifier,
  RecordField,
  TextMap_Entry,
  Value,
} from "@generated/proto/com/daml/ledger/api/v2/value_pb";
import { concat } from "./utils";
import {
  encodeBool,
  encodeInt64,
  encodeString,
  encodeInt32,
  encodeHexString,
  encodeOptional,
  encodeRepeated,
} from "./primitive";
import {
  VALUE_TYPE_UNIT,
  VALUE_TYPE_BOOL,
  VALUE_TYPE_INT64,
  VALUE_TYPE_NUMERIC,
  VALUE_TYPE_TIMESTAMP,
  VALUE_TYPE_DATE,
  VALUE_TYPE_PARTY,
  VALUE_TYPE_TEXT,
  VALUE_TYPE_CONTRACT_ID,
  VALUE_TYPE_OPTIONAL,
  VALUE_TYPE_LIST,
  VALUE_TYPE_TEXT_MAP,
  VALUE_TYPE_RECORD,
  VALUE_TYPE_VARIANT,
  VALUE_TYPE_ENUM,
  VALUE_TYPE_GEN_MAP,
} from "./constants";

/**
 * Encodes a DAML template identifier consisting of package ID, module name, and entity name.
 */
export const encodeIdentifier = (identifier: Identifier): Uint8Array =>
  concat(
    encodeString(identifier.packageId),
    encodeRepeated(identifier.moduleName.split("."), encodeString),
    encodeRepeated(identifier.entityName.split("."), encodeString),
  );

/**
 * Encodes a DAML value into its canonical wire format.
 * Handles all DAML value types: unit, bool, int64, numeric, timestamp, date, party, text, contractId,
 * optional, list, textMap, record, variant, enum, and generic map.
 *
 * @throws {Error} If the value type is unsupported
 */
export const encodeValue = (value: Value | null | undefined): Uint8Array => {
  switch (value?.sum?.case) {
    case "unit":
      return VALUE_TYPE_UNIT;
    case "bool":
      return concat(VALUE_TYPE_BOOL, encodeBool(value.sum.value));
    case "int64":
      return concat(VALUE_TYPE_INT64, encodeInt64(value.sum.value));
    case "numeric":
      return concat(VALUE_TYPE_NUMERIC, encodeString(value.sum.value));
    case "timestamp":
      return concat(VALUE_TYPE_TIMESTAMP, encodeInt64(value.sum.value));
    case "date":
      return concat(VALUE_TYPE_DATE, encodeInt32(value.sum.value));
    case "party":
      return concat(VALUE_TYPE_PARTY, encodeString(value.sum.value));
    case "text":
      return concat(VALUE_TYPE_TEXT, encodeString(value.sum.value));
    case "contractId":
      return concat(VALUE_TYPE_CONTRACT_ID, encodeHexString(value.sum.value));
    case "optional": {
      return concat(
        VALUE_TYPE_OPTIONAL,
        encodeOptional(value.sum.value.value, encodeValue),
      );
    }
    case "list":
      return concat(
        VALUE_TYPE_LIST,
        encodeRepeated(value.sum.value.elements, encodeValue),
      );
    case "textMap":
      return concat(
        VALUE_TYPE_TEXT_MAP,
        encodeRepeated(value.sum.value.entries, encodeTextMapEntry),
      );
    case "record": {
      return concat(
        VALUE_TYPE_RECORD,
        encodeOptional(value.sum.value.recordId, encodeIdentifier),
        encodeRepeated(value.sum.value.fields, encodeRecordField),
      );
    }
    case "variant": {
      return concat(
        VALUE_TYPE_VARIANT,
        encodeOptional(value.sum.value.variantId, encodeIdentifier),
        encodeString(value.sum.value.constructor$),
        encodeValue(value.sum.value.value!),
      );
    }
    case "enum": {
      return concat(
        VALUE_TYPE_ENUM,
        encodeOptional(value.sum.value.enumId, encodeIdentifier),
        encodeString(value.sum.value.constructor$),
      );
    }
    case "genMap":
      return concat(
        VALUE_TYPE_GEN_MAP,
        encodeRepeated(value.sum.value.entries, encodeGenMapEntry),
      );
    default:
      throw new Error(`Unsupported value type: ${value?.sum?.case}`);
  }
};

/**
 * Encodes a text map entry (key-value pair with string key).
 * @param entry - The TextMap_Entry with string key and Value value
 * @returns A Uint8Array with encoded key followed by encoded value
 */
export const encodeTextMapEntry = (entry: TextMap_Entry): Uint8Array =>
  concat(encodeString(entry.key), encodeValue(entry.value!));

/**
 * Encodes a record field with optional label.
 * @param field - The RecordField with optional label and value
 * @returns A Uint8Array with optional label followed by encoded value
 */
export const encodeRecordField = (field: RecordField): Uint8Array =>
  concat(encodeOptional(field.label, encodeString), encodeValue(field.value!));

/**
 * Encodes a generic map entry (key-value pair with arbitrary key type).
 * @param entry - The GenMap_Entry with Value key and Value value
 * @returns A Uint8Array with encoded key followed by encoded value
 */
export const encodeGenMapEntry = (entry: GenMap_Entry): Uint8Array =>
  concat(encodeValue(entry.key!), encodeValue(entry.value!));
