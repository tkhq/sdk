import * as crypto from "crypto";

export function assertValidSignature({
  content,
  pemPublicKey,
  signature,
}: {
  content: string;
  pemPublicKey: string;
  signature: string;
}): true {
  const verifier = crypto.createVerify("SHA256");
  verifier.update(content);
  verifier.end();

  if (verifier.verify(pemPublicKey, signature, "hex")) {
    return true;
  }

  throw new Error(
    [
      `Invalid signature.`,
      `content: ${JSON.stringify(content)}`,
      `pemPublicKey: ${JSON.stringify(pemPublicKey)}`,
      `signature: ${JSON.stringify(signature)}`,
    ].join("\n"),
  );
}
