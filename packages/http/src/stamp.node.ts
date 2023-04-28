import * as crypto from "crypto";
import type { TStamper } from "./shared";

// Specific byte-sequence for P-256 (DER encoding)
const PRIVATE_KEY_PREFIX = Buffer.from(
  "308141020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420",
  "hex"
);

export const stamp: TStamper = async (input: {
  content: string;
  publicKey: string;
  privateKey: string;
}) => {
  const { content, publicKey, privateKey } = input;

  const privateKeyBuffer = Buffer.from(privateKey, "hex");
  const privateKeyPkcs8Der = Buffer.concat([
    PRIVATE_KEY_PREFIX,
    privateKeyBuffer,
  ]);

  const privateKeyObject = crypto.createPrivateKey({
    type: "pkcs8",
    format: "der",
    key: privateKeyPkcs8Der,
  });

  const sign = crypto.createSign("SHA256");
  sign.write(Buffer.from(content));
  sign.end();

  const signature = sign.sign(privateKeyObject, "hex");

  return {
    publicKey: publicKey,
    scheme: "SIGNATURE_SCHEME_TK_API_P256",
    signature: signature,
  };
};
