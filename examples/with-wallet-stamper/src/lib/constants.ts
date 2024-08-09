export const ETHEREUM_WALLET_DEFAULT_PATH = "m/44'/60'/0'/0/0";

// This constant designates the type of credential we want to create.
// The enum only supports one value, "public-key"
// https://www.w3.org/TR/webauthn-2/#enumdef-publickeycredentialtype
// @todo - link to code where this is used?
export const PUBKEY_CRED_TYPE = "public-key";

// All algorithms can be found here: https://www.iana.org/assignments/cose/cose.xhtml#algorithms
// We only support ES256
export const ALG_ES256 = -7;
export const ALG_RS256 = -257;

export const ACCOUNT_CONFIG_EVM = {
  curve: "CURVE_SECP256K1" as const,
  pathFormat: "PATH_FORMAT_BIP32" as const,
  path: ETHEREUM_WALLET_DEFAULT_PATH,
  addressFormat: "ADDRESS_FORMAT_ETHEREUM" as const,
  curveType: "API_KEY_CURVE_SECP256K1" as const,
};

export const ACCOUNT_CONFIG_SOLANA = {
  pathFormat: "PATH_FORMAT_BIP32" as const,
  path: "m/44'/501'/0'/0'",
  curve: "CURVE_ED25519" as const,
  addressFormat: "ADDRESS_FORMAT_SOLANA" as const,
};

export const CURVE_TYPE_ED25519 = "API_KEY_CURVE_ED25519" as const;
export const CURVE_TYPE_SECP256K1 = "API_KEY_CURVE_SECP256K1" as const;
