import * as crypto from "crypto";
import { convertTurnkeyApiKeyToJwk } from "./utils";

export const signWithApiKey = async (input: {
  content: string;
  publicKey: string;
  privateKey: string;
}): Promise<string> => {
  const { content, publicKey, privateKey } = input;

  const privateKeyObject = crypto.createPrivateKey({
    // @ts-expect-error -- the key can be a JWK object since Node v15.12.0
    // https://nodejs.org/api/crypto.html#cryptocreateprivatekeykey
    key: convertTurnkeyApiKeyToJwk({
      uncompressedPrivateKeyHex: privateKey,
      compressedPublicKeyHex: publicKey,
    }),
    format: "jwk",
  });

  const sign = crypto.createSign("SHA256");
  sign.write(Buffer.from(content));
  sign.end();

  return sign.sign(privateKeyObject, "hex");
};
