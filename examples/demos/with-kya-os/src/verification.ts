import {
  MemoryNonceCacheProvider,
  NodeCryptoProvider,
  NoopFetchProvider,
  ProofVerifier,
  SystemClockProvider,
  createDidKeyResolver,
  extractProofFromMeta,
  type ToolRequest,
} from "@kya-os/mcp";

export interface Receipt {
  request: ToolRequest;
  response: {
    content: unknown[];
    _meta?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export function createPublicVerifier() {
  return new ProofVerifier({
    cryptoProvider: new NodeCryptoProvider(),
    clockProvider: new SystemClockProvider(),
    nonceCacheProvider: new MemoryNonceCacheProvider(),
    fetchProvider: new NoopFetchProvider(),
    requireAtomicNonce: true,
  });
}

export async function verifyReceipt(
  receipt: Receipt,
  expectedServerDid: string,
  verifier = createPublicVerifier(),
) {
  const extracted = extractProofFromMeta(receipt.response._meta ?? {});
  if (!extracted.success) throw new Error("The response has no KYA-OS proof.");
  const proof = extracted.proof;
  const document = await createDidKeyResolver().resolve(expectedServerDid);
  const method = document?.verificationMethod?.find(
    (entry) => entry.id === proof.meta.kid,
  );
  if (!method?.publicKeyJwk)
    throw new Error("The proof key does not belong to the expected server.");
  const bindsResponse = proof.meta.responseHash !== undefined;
  const result = await verifier.verifyProof(
    proof,
    {
      ...(method.publicKeyJwk as {
        kty: "OKP";
        crv: "Ed25519";
        x: string;
      }),
      kid: method.id,
    },
    {
      request: receipt.request,
      ...(bindsResponse ? { response: { data: receipt.response } } : {}),
    },
    { expectedDid: expectedServerDid, expectedAudience: expectedServerDid },
  );
  return { ...result, bindsResponse };
}
