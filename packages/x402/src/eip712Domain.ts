import { getTypesForEIP712Domain, type TypedDataDefinition } from "viem";

/**
 * Adds the `EIP712Domain` type for the domain's fields. Without it, viem's
 * `serializeTypedData`, which `@turnkey/viem` uses, sends Turnkey an empty
 * domain.
 */
export function withEip712DomainTypes(typedData: {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  primaryType: string;
  message: Record<string, unknown>;
}): TypedDataDefinition {
  return {
    ...typedData,
    types: {
      EIP712Domain: getTypesForEIP712Domain({ domain: typedData.domain }),
      ...typedData.types,
    },
  } as TypedDataDefinition;
}
