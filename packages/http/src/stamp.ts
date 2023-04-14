import * as crypto from "crypto";

// Specific byte-sequence for curve prime256v1 (DER encoding)
const PRIVATE_KEY_PREFIX = Buffer.from(
  "308141020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420",
  "hex"
);

export async function stamp(input: {
  content: string;
  publicKey: string;
  privateKey: string;
}) {
  const { content, publicKey, privateKey } = input;

  const key = await importPrivateKey(privateKey);
  const signature = await signMessage(key, content);

  return {
    publicKey: publicKey,
    scheme: "SIGNATURE_SCHEME_TK_API_P256",
    signature: signature,
  };
}

async function importPrivateKey(
  privateKeyHex: string
): Promise<crypto.webcrypto.CryptoKey> {
  const privateKeyBuffer = Buffer.from(privateKeyHex, "hex");
  const privateKeyPkcs8Der = Buffer.concat([
    PRIVATE_KEY_PREFIX,
    privateKeyBuffer,
  ]);

  return await crypto.webcrypto.subtle.importKey(
    "pkcs8",
    privateKeyPkcs8Der,
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    false, // not extractable
    ["sign"] // allow signing
  );
}

async function signMessage(
  privateKey: crypto.webcrypto.CryptoKey,
  content: string
): Promise<string> {
  const sign = crypto.createSign("SHA256");

  sign.write(Buffer.from(content));
  sign.end();

  const signature = sign.sign(privateKey as any, "hex");

  return signature;
}
