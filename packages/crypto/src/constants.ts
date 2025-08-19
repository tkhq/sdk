export const SUITE_ID_1 = new Uint8Array([75, 69, 77, 0, 16]); //KEM suite ID
export const SUITE_ID_2 = new Uint8Array([72, 80, 75, 69, 0, 16, 0, 1, 0, 2]); //HPKE suite ID
export const HPKE_VERSION = new Uint8Array([72, 80, 75, 69, 45, 118, 49]); //HPKE-v1
export const LABEL_SECRET = new Uint8Array([115, 101, 99, 114, 101, 116]); //secret
export const LABEL_EAE_PRK = new Uint8Array([101, 97, 101, 95, 112, 114, 107]); //eae_prk
export const LABEL_SHARED_SECRET = new Uint8Array([
  115, 104, 97, 114, 101, 100, 95, 115, 101, 99, 114, 101, 116,
]); //shared_secret
export const AES_KEY_INFO = new Uint8Array([
  0, 32, 72, 80, 75, 69, 45, 118, 49, 72, 80, 75, 69, 0, 16, 0, 1, 0, 2, 107,
  101, 121, 0, 143, 195, 174, 184, 50, 73, 10, 75, 90, 179, 228, 32, 35, 40,
  125, 178, 154, 31, 75, 199, 194, 34, 192, 223, 34, 135, 39, 183, 10, 64, 33,
  18, 47, 63, 4, 233, 32, 108, 209, 36, 19, 80, 53, 41, 180, 122, 198, 166, 48,
  185, 46, 196, 207, 125, 35, 69, 8, 208, 175, 151, 113, 201, 158, 80,
]); //key
export const IV_INFO = new Uint8Array([
  0, 12, 72, 80, 75, 69, 45, 118, 49, 72, 80, 75, 69, 0, 16, 0, 1, 0, 2, 98, 97,
  115, 101, 95, 110, 111, 110, 99, 101, 0, 143, 195, 174, 184, 50, 73, 10, 75,
  90, 179, 228, 32, 35, 40, 125, 178, 154, 31, 75, 199, 194, 34, 192, 223, 34,
  135, 39, 183, 10, 64, 33, 18, 47, 63, 4, 233, 32, 108, 209, 36, 19, 80, 53,
  41, 180, 122, 198, 166, 48, 185, 46, 196, 207, 125, 35, 69, 8, 208, 175, 151,
  113, 201, 158, 80,
]); //base_nonce
export const QOS_ENCRYPTION_HMAC_MESSAGE = new TextEncoder().encode(
  "qos_encryption_hmac_message",
); // used for encrypting messages to quorum keys matched whats found here: https://github.com/tkhq/qos/blob/ae01904c756107f850aea42000137ef124df3fe4/src/qos_p256/src/encrypt.rs#L22
export const PRODUCTION_SIGNER_SIGN_PUBLIC_KEY =
  "04cf288fe433cc4e1aa0ce1632feac4ea26bf2f5a09dcfe5a42c398e06898710330f0572882f4dbdf0f5304b8fc8703acd69adca9a4bbf7f5d00d20a5e364b2569";

export const PRODUCTION_NOTARIZER_SIGN_PUBLIC_KEY =
  "04d498aa87ac3bf982ac2b5dd9604d0074905cfbda5d62727c5a237b895e6749205e9f7cd566909c4387f6ca25c308445c60884b788560b785f4a96ac33702a469";

export const PRODUCTION_TLS_FETCHER_ENCRYPT_PUBLIC_KEY =
  "045e899f1fcf7d12b3c8fd997a7a43bb853dd4e8d63419a8f867c70aacc1c4cf9d04848baca41f0c85ffbbd23cbf78967501cd8eca9e4a6369370a9a38f70d13c0";

export const PRODUCTION_SIGNER_ENCRYPT_PUBLIC_KEY =
  "04ca7c0d624c75de6f34af342e87a21e0d8c83efd1bd5b5da0c0177c147f744fba6f01f9f37356f9c617659aafa55f6e0af8d169a8f054d153ab3201901fb63ecb";

export const PRODUCTION_UMP_ENCRYPT_PUBLIC_KEY =
  "0497f918dd3fb4c9d1273729bc6811a1b5ab7e616ca239f9c852f4a3beb6f81965bd2001a97c56ff775c6a10ba5f6c314709191cb642a8142638cada06ef93e50b";

export const PRODUCTION_EVM_PARSER_ENCRYPT_PUBLIC_KEY =
  "041bb839392ab93d2c89a697634fc9c94672b9fd141dd436acf50ce2a4a9666d050ce1f70a73653f1584f7b7b38823acd6f7d3de75488f6251e35536dcaacb6ed6";

export const PRODUCTION_NOTARIZER_ENCRYPT_PUBLIC_KEY =
  "04933a9127132a99998e7c695d9d72ed26014b053c3fb2f8d2495d38edcf4036cd46d5b2e0f9527e4f9fb74b529151a4fe16281a338c0ca29cb5b443d266b5f2c8";
