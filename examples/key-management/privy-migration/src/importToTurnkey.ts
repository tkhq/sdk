/**
 * importToTurnkey.ts
 *
 * Wraps the two-step Turnkey private-key import activity flow:
 *   1. initImportPrivateKey  -> enclave returns a signed target public key
 *      (the "import bundle").
 *   2. encryptPrivateKeyToBundle (client side, from @turnkey/crypto)
 *      HPKE-encrypts the plaintext to that target public key and verifies
 *      the enclave's quorum signature before returning the encrypted bundle.
 *   3. importPrivateKey      -> submit the encrypted bundle; the enclave
 *      decrypts inside the TEE and materialises a private key resource.
 */

import { Turnkey } from "@turnkey/sdk-server";
import { encryptPrivateKeyToBundle } from "@turnkey/crypto";

export type ImportChain = "evm" | "solana";

export type ImportResult = {
  privateKeyId: string;
  addresses: { address: string; format: string }[];
};

export function turnkeyClient(env: {
  apiBaseUrl: string;
  apiPublicKey: string;
  apiPrivateKey: string;
  organizationId: string;
}): Turnkey {
  return new Turnkey({
    apiBaseUrl: env.apiBaseUrl,
    apiPublicKey: env.apiPublicKey,
    apiPrivateKey: env.apiPrivateKey,
    defaultOrganizationId: env.organizationId,
  });
}

/**
 * Runs the full three-step import. Callers must pass in the plaintext
 * private key already formatted to Turnkey's expected shape (see
 * `formatPrivyPlaintext` in exportFromPrivy.ts).
 */
export async function importPrivateKeyIntoTurnkey(args: {
  client: Turnkey;
  organizationId: string;
  userId: string;
  privateKeyName: string;
  chain: ImportChain;
  privateKey: string;
  keyFormat: "HEXADECIMAL" | "SOLANA";
}): Promise<ImportResult> {
  const api = args.client.apiClient();

  // Step 1: enclave issues a target encryption key (TEK) + quorum signature.
  const initResult = await api.initImportPrivateKey({ userId: args.userId });

  // Step 2: HPKE-encrypt the plaintext to the enclave TEK. This function
  // verifies the enclave's quorum signature on the target public key before
  // encrypting, so we never encrypt to an attacker-controlled key.
  const encryptedBundle = await encryptPrivateKeyToBundle({
    privateKey: args.privateKey,
    keyFormat: args.keyFormat,
    importBundle: initResult.importBundle,
    userId: args.userId,
    organizationId: args.organizationId,
  });

  // Step 3: submit. The enclave decrypts *inside* the TEE; the ciphertext
  // is only ever addressable by the enclave's private key, which never
  // leaves the TEE.
  const curve = args.chain === "solana" ? "CURVE_ED25519" : "CURVE_SECP256K1";
  const addressFormats =
    args.chain === "solana"
      ? (["ADDRESS_FORMAT_SOLANA"] as const)
      : (["ADDRESS_FORMAT_ETHEREUM"] as const);

  const result = await api.importPrivateKey({
    userId: args.userId,
    privateKeyName: args.privateKeyName,
    encryptedBundle,
    curve,
    addressFormats: [...addressFormats],
  });

  return {
    privateKeyId: result.privateKeyId,
    addresses: result.addresses.map((a) => ({
      address: a.address ?? "",
      format: a.format ?? "",
    })),
  };
}
