import { toClientEvmSigner, type ClientEvmSigner } from "@x402/evm";
import { sha256, stringToBytes, type Hex } from "viem";
import { withEip712DomainTypes } from "./eip712Domain";
import type { TypedDataSigner } from "./typedData";

export {
  decodePaymentRequiredHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";

/**
 * Adapts a viem account (such as one from `@turnkey/viem`) to the signer the
 * official x402 client expects for the `exact` EVM scheme.
 */
export function createX402Signer(
  account: TypedDataSigner,
  publicClient?: Parameters<typeof toClientEvmSigner>[1],
): ClientEvmSigner {
  return toClientEvmSigner(
    {
      address: account.address,
      signTypedData: (message) =>
        account.signTypedData(withEip712DomainTypes(message)),
    },
    publicClient,
  );
}

/**
 * Derives an EIP-3009 nonce from a binding: the SHA-256 of the binding's
 * RFC 8785 canonical JSON, as 0x-prefixed 32-byte hex.
 */
export function boundNonce(binding: Record<string, string>): Hex {
  for (const [key, value] of Object.entries(binding)) {
    if (typeof value !== "string") {
      throw new TypeError(`binding value for ${key} must be a string`);
    }
  }
  const members = Object.keys(binding)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${JSON.stringify(binding[key])}`);
  return sha256(stringToBytes(`{${members.join(",")}}`));
}
