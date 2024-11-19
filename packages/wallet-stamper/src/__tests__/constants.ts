import type { UUID } from "crypto";
import "dotenv/config";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUB_ORGANIZATION_ID: UUID;
      ORGANIZATION_ID: UUID;
      BASE_URL: string;
    }
  }
}

// Solana Keys
export const SOLANA_PRIVATE_KEY = Uint8Array.from([
  54, 134, 140, 93, 245, 84, 88, 28, 70, 88, 146, 41, 96, 249, 255, 68, 174,
  234, 116, 222, 171, 251, 197, 90, 154, 57, 160, 9, 139, 77, 42, 175, 84, 219,
  243, 0, 102, 22, 193, 175, 174, 193, 235, 206, 170, 34, 164, 136, 177, 133,
  107, 252, 123, 4, 83, 165, 63, 176, 151, 221, 105, 250, 100, 229,
]);

export const SOLANA_PUBLIC_KEY = "6iFmi3WEaTEvduaf4gGK13Wy6GvtWv5PYYjvj13ZMitt";

export const SOLANA_PUBLIC_KEY_DECODED =
  "54dbf3006616c1afaec1ebceaa22a488b1856bfc7b0453a53fb097dd69fa64e5";

// Ethereum Keys
export const ETHEREUM_PUBLIC_KEY =
  "0x048318535b54105d4a7aae60c08fc45f9687181b4fdfc625bd1a753fa7397fed753547f11ca8696646f2f3acb08e31016afac23e630c5d11f59f61fef57b0d2aa5";

export const ETHEREUM_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// Expected compressed public key associated with SUB_ORGANIZATION_ID
export const EXPECTED_COMPRESSED_PUBLIC_KEY =
  "038318535b54105d4a7aae60c08fc45f9687181b4fdfc625bd1a753fa7397fed75";

// Expected signatures over the message "MESSAGE"
export const EXPECTED_SIGNATURE =
  "0x487cdb8a88f2f4044b701cbb116075c4cabe5fe4657a6358b395c0aab70694db3453a8057e442bd1aff0ecabe8a82c831f0edd7f2158b7c1feb3de9b1f20309b1c";
export const EXPECTED_DER_SIGNATURE =
  "30440220487cdb8a88f2f4044b701cbb116075c4cabe5fe4657a6358b395c0aab70694db02203453a8057e442bd1aff0ecabe8a82c831f0edd7f2158b7c1feb3de9b1f20309b";

// Environment variables
export const ORGANIZATION_ID = process.env.ORGANIZATION_ID;
export const BASE_URL = process.env.BASE_URL;
