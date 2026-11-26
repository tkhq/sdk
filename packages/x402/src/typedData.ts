import { authorizationTypes } from "@x402/evm";
import { withEip712DomainTypes } from "./eip712Domain";
import {
  hashTypedData,
  type Address,
  type Hex,
  type TypedDataDefinition,
} from "viem";

export type Eip3009Token = {
  address: Address;
  chainId: number;
  name: string;
  version: string;
};

export type TransferWithAuthorizationInput = {
  token: Eip3009Token;
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
};

export type TypedDataSigner = {
  address: Address;
  signTypedData(typedData: TypedDataDefinition): Promise<Hex>;
};

/**
 * Builds the EIP-712 typed data for an EIP-3009 `transferWithAuthorization`,
 * using the type definitions of the x402 `exact` EVM scheme.
 */
export function transferWithAuthorizationTypedData(
  input: TransferWithAuthorizationInput,
) {
  const { token, from, to, value, validAfter, validBefore, nonce } = input;
  return {
    domain: {
      name: token.name,
      version: token.version,
      chainId: token.chainId,
      verifyingContract: token.address,
    },
    types: authorizationTypes,
    primaryType: "TransferWithAuthorization" as const,
    message: { from, to, value, validAfter, validBefore, nonce },
  };
}

export type TransferWithAuthorizationTypedData = ReturnType<
  typeof transferWithAuthorizationTypedData
>;

/**
 * Signs EIP-3009 typed data with a viem account. With an account from
 * `@turnkey/viem`, Turnkey signs it through `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2`
 * with `PAYLOAD_ENCODING_EIP712`. Returns the signature and the EIP-712 digest.
 */
export async function signTransferWithAuthorization(
  account: TypedDataSigner,
  typedData: TransferWithAuthorizationTypedData,
): Promise<{ signature: Hex; digest: Hex }> {
  const signature = await account.signTypedData(
    withEip712DomainTypes(typedData),
  );
  return { signature, digest: hashTypedData(typedData) };
}

/** Converts US cents (2 decimals) to USDC atomic units (6 decimals). */
export function usdMinorToUsdcAtomic(cents: bigint | number): bigint {
  if (typeof cents === "number" && !Number.isSafeInteger(cents)) {
    throw new RangeError(`cents must be a safe integer, got ${cents}`);
  }
  const value = BigInt(cents);
  if (value < 0n) {
    throw new RangeError(`cents must not be negative, got ${value}`);
  }
  return value * 10_000n;
}
